/**
 * Intent Parser — multilingual extraction with deterministic fallbacks.
 * Uses LLM when available, falls back to keyword matching + lookup tables.
 */
import { admin } from '@/lib/supabase/admin';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import type { AgentContext, Intent } from '../types';
import { generateStructured } from '../llm';
import { IntentSchema } from '../types';

interface IntentInput {
  raw_text: string;
  locale: 'en' | 'ur' | 'ur-Latn';
  selected_user_location: {
    id: string;
    address_text: string;
    city: string | null;
    town_or_area: string | null;
    point: { lat: number; lng: number };
  };
  prior_intent?: Intent;
}

const TZ = 'Asia/Karachi';

// Roman Urdu / Urdu / English keyword → service slug table.
// Fallback path only — the LLM is the primary classifier.
const SERVICE_KEYWORDS: Array<{ slug: string; words: string[] }> = [
  { slug: 'ac_repair',        words: ['ac', 'air condition', 'a/c', 'cooling', 'thanda', 'air-condition', 'gas refill', 'اے سی'] },
  { slug: 'plumber',          words: ['plumber', 'plumbing', 'pani', 'water', 'leak', 'leakage', 'pipe', 'tap', 'nal', 'tank', 'tanki', 'tank clean', 'water tank', 'drainage', 'sewerage', 'پلمبر', 'پانی', 'ٹینکی'] },
  { slug: 'electrician',      words: ['electrician', 'bijli', 'wiring', 'switch', 'meter', 'light', 'fan', 'roshni', 'الیکٹریشن', 'بجلی'] },
  { slug: 'tutor',            words: ['tutor', 'teacher', 'ustad', 'math', 'physics', 'english', 'tuition', 'ٹیوٹر', 'استاد'] },
  { slug: 'beautician',       words: ['beautician', 'salon', 'makeup', 'hair', 'threading', 'facial', 'بیوٹیشن'] },
  { slug: 'carpenter',        words: ['carpenter', 'barhai', 'wood', 'lakri', 'furniture', 'mez', 'kursi', 'almari', 'بڑھئی'] },
  { slug: 'car_wash',         words: ['car wash', 'gaari dhulai', 'gaari wash', 'detailing', 'کار واش'] },
  { slug: 'car_mechanic',     words: ['mechanic', 'car repair', 'engine', 'brake', 'clutch', 'tune up', 'workshop', 'car problem', 'gaari kharab', 'car mechanic'] },
  { slug: 'mobile_repair',    words: ['mobile', 'phone', 'screen', 'battery', 'موبائل'] },
  { slug: 'house_cleaning',   words: ['house cleaning', 'home cleaning', 'saafai', 'safai', 'jhaaru', 'pocha', 'dusting', 'maid', 'بائی', 'cleaning service'] },
  { slug: 'cook',             words: ['cook', 'chef', 'khansama', 'khaana', 'khana', 'catering', 'baawarchi', 'baworchi', 'dawat', 'party catering'] },
  { slug: 'painter',          words: ['painter', 'paint', 'wall paint', 'rang', 'polish', 'distemper', 'enamel', 'paintwork'] },
  { slug: 'mason',            words: ['mason', 'raj mistri', 'rajmistri', 'brick', 'cement', 'plaster', 'construction work', 'taameer'] },
  { slug: 'appliance_repair', words: ['fridge', 'refrigerator', 'washing machine', 'dryer', 'microwave', 'oven', 'appliance', 'home appliance'] },
  { slug: 'gardening',        words: ['gardener', 'mali', 'garden', 'lawn', 'pruning', 'pouda', 'pouday', 'grass cutting'] },
  { slug: 'pest_control',     words: ['pest control', 'fumigation', 'cockroach', 'rats', 'termite', 'keera', 'macchar', 'pest spray'] },
];

const TIME_PHRASES: Array<{ pattern: RegExp; calc: (now: Date) => Date; urgency: Intent['urgency'] }> = [
  { pattern: /(kal|tomorrow|کل)\s*(subah|morning|صبح)?/i, calc: (now) => setMs(addDays(setHours(now, 9), 1)), urgency: 'tomorrow' },
  { pattern: /(kal|tomorrow|کل)\s*(shaam|evening|شام)/i, calc: (now) => setMs(addDays(setHours(now, 17), 1)), urgency: 'tomorrow' },
  { pattern: /(aaj|today|آج)\s*(shaam|evening|شام)/i, calc: (now) => setMs(setHours(now, 17)), urgency: 'today' },
  { pattern: /(aaj|today|آج)/i, calc: (now) => setMs(setHours(now, 14)), urgency: 'today' },
  { pattern: /(abhi|now|ابھی)/i, calc: (now) => now, urgency: 'now' },
  { pattern: /(parson|day after)/i, calc: (now) => setMs(addDays(setHours(now, 9), 2)), urgency: 'this_week' },
];

function setMs(d: Date): Date {
  return setMilliseconds(setSeconds(setMinutes(d, 0), 0), 0);
}

function sectorMatch(text: string): { sector: string; lat: number; lng: number } | null {
  const m = text.match(/\b([gfi]-\d+)\b/i);
  if (!m) return null;
  const STATIC: Record<string, [number, number]> = {
    'g-13': [33.6469, 72.9560], 'g-14': [33.6280, 72.9300],
    'f-7': [33.7160, 72.9930], 'f-8': [33.7060, 73.0100], 'f-10': [33.6856, 73.0072], 'f-11': [33.6928, 72.9853],
    'i-8': [33.6776, 73.0700], 'i-9': [33.6620, 73.0610],
  };
  const k = m[1].toLowerCase();
  if (!STATIC[k]) return null;
  return { sector: m[1].toUpperCase(), lat: STATIC[k][0], lng: STATIC[k][1] };
}

const VALID_SLUGS = new Set([
  'ac_repair', 'plumber', 'electrician', 'tutor', 'beautician', 'carpenter', 'car_wash', 'mobile_repair',
  'car_mechanic', 'house_cleaning', 'cook', 'painter', 'mason', 'appliance_repair', 'gardening', 'pest_control',
]);

export async function runIntentParser(input: IntentInput, ctx: AgentContext, stepIndex: number): Promise<Intent> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'intent_parser', stepIndex, startedAt, inputs: input, status: 'running' });

  const text = input.raw_text.toLowerCase();
  let bestSlug: string | null = null;
  let bestConfidence = 0;
  let classifierSource: 'llm' | 'keyword' | 'none' = 'none';
  let llmNotes = '';
  let complexity: 'basic' | 'intermediate' | 'complex' = 'basic';

  // Budget preference — deterministic keyword extraction (runs before LLM).
  const LOW_BUDGET_WORDS = ['sasta', 'cheap', 'affordable', 'kam daam', 'kam paise', 'budget', 'economical', 'سستا'];
  const HIGH_BUDGET_WORDS = ['best', 'premium', 'top', 'acha wala', 'mahenga', 'mehenga', 'expensive', 'quality', 'beh'];
  let budgetPreference: 'low' | 'mid' | 'high' | null = null;
  if (LOW_BUDGET_WORDS.some((w) => text.includes(w))) budgetPreference = 'low';
  else if (HIGH_BUDGET_WORDS.some((w) => text.includes(w))) budgetPreference = 'high';

  // 1) PRIMARY: LLM classification with context awareness.
  // The LLM understands phrasing like "tank clean karwana hai" → plumber,
  // "AC me gas chahiye" → ac_repair, "kal subah hair cut" → beautician.
  try {
    const llmResult = await generateStructured({
      systemInstruction: [
        'You classify informal-economy service requests in English / Urdu / Roman Urdu into one of these slugs:',
        '  ac_repair, plumber, electrician, tutor, beautician, carpenter, car_wash, mobile_repair',
        '',
        'Map related concepts to the closest slug — examples:',
        '- water tank cleaning, tanki saaf, drainage, sewerage, pipe leak → plumber',
        '- AC servicing, cooling, gas refill, fridge cooling → ac_repair',
        '- wiring, fan repair, bijli, light fitting, meter → electrician',
        '- hair, makeup, salon, threading, facial, manicure → beautician',
        '- furniture, mez, kursi, almari, wood, lakri → carpenter',
        '- car wash, dhulai, polish, detailing → car_wash',
        '- phone repair, screen, battery, mobile → mobile_repair',
        '- tuition, ustad, math, physics, lesson → tutor',
        '',
        'Always pick the CLOSEST slug. Only set service_confidence below 0.5 if the request is genuinely outside these 8 categories (e.g. "I want food", "buy clothes").',
        'For valid service requests, set service_confidence between 0.7 and 0.95.',
        'Also extract any contextual hints into a short notes field (e.g. "water tank cleaning", "screen replacement").',
        '',
        'Also classify the JOB COMPLEXITY into one of:',
        '- "basic": single-task, no specialized tools (e.g. fan switch lagao, fridge saaf, mobile screen guard)',
        '- "intermediate": needs tools or 1-2 hours (e.g. AC service, pipe leak fix, washing machine repair)',
        '- "complex": multi-hour or specialized skill (e.g. AC gas refill + diagnostic, whole-house wiring, engine rebuild)',
        'Default to "basic" if unclear.',
        'Output JSON.',
      ].join('\n'),
      userPrompt: `User said: "${input.raw_text}" (locale=${input.locale}).`,
      schema: IntentSchema.partial(),
    });
    if (llmResult?.service_slug && VALID_SLUGS.has(llmResult.service_slug)) {
      const llmConf = llmResult.service_confidence ?? 0.75;
      if (llmConf >= 0.5) {
        bestSlug = llmResult.service_slug;
        bestConfidence = llmConf;
        classifierSource = 'llm';
        llmNotes = llmResult.notes ?? '';
      }
    }
    // Pick up complexity even if confidence below threshold (it's optional context).
    const llmComplexity = (llmResult as { complexity?: 'basic' | 'intermediate' | 'complex' } | null)?.complexity;
    if (llmComplexity === 'basic' || llmComplexity === 'intermediate' || llmComplexity === 'complex') {
      complexity = llmComplexity;
    }
  } catch (e) {
    ctx.logger.warn('intent llm unavailable; will fall back to keywords', e);
  }

  // 2) FALLBACK: deterministic keyword match (used when LLM is unavailable
  // or returned a low-confidence / invalid slug).
  if (!bestSlug) {
    for (const { slug, words } of SERVICE_KEYWORDS) {
      for (const w of words) {
        if (text.includes(w.toLowerCase())) {
          const c = w.length >= 4 ? 0.85 : 0.6;
          if (c > bestConfidence) {
            bestSlug = slug;
            bestConfidence = c;
            classifierSource = 'keyword';
          }
        }
      }
    }
  }

  // 3) Location resolution
  const sector = sectorMatch(input.raw_text);
  const locationPoint = sector ? { lat: sector.lat, lng: sector.lng } : input.selected_user_location.point;
  const locationText = sector ? `${sector.sector}, Islamabad` : (input.selected_user_location.address_text);
  const locationSource: Intent['location']['source'] = sector ? 'user_mentioned' : 'user_location';

  // 3) Time resolution
  const nowLocal = toZonedTime(new Date(), TZ);
  let resolved = setMs(addDays(setHours(nowLocal, 9), 1)); // default: tomorrow 9 AM
  let urgency: Intent['urgency'] = 'tomorrow';
  let originalPhrase = '';
  for (const t of TIME_PHRASES) {
    const m = input.raw_text.match(t.pattern);
    if (m) { resolved = t.calc(nowLocal); urgency = t.urgency; originalPhrase = m[0]; break; }
  }
  const resolvedUtc = fromZonedTime(resolved, TZ);

  const needsClarification = !bestSlug || bestConfidence < 0.5
    ? { field: 'service', question_en: 'What service do you need (AC, plumber, tutor, etc.)?', question_ur: 'آپ کو کون سی خدمت چاہیے؟' }
    : undefined;

  const intent: Intent = {
    service_slug: bestSlug ?? 'ac_repair',
    service_confidence: bestConfidence || 0.5,
    location: { text: locationText, point: locationPoint, source: locationSource, confidence: 0.85 },
    time: { iso: resolvedUtc.toISOString(), original_phrase: originalPhrase || input.raw_text, confidence: 0.75 },
    urgency,
    notes: llmNotes,
    complexity,
    budget_preference: budgetPreference,
    needs_clarification: needsClarification,
  };

  // Validate slug against DB
  if (intent.service_slug) {
    const { data: cat } = await admin.from('service_categories').select('slug').eq('slug', intent.service_slug).maybeSingle();
    if (!cat) intent.needs_clarification = { field: 'service', question_en: 'I did not recognize that service.', question_ur: 'یہ خدمت سمجھ نہیں آئی۔' };
  }

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'intent_parser', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    inputs: input, outputs: intent,
    reasoning: `Service=${intent.service_slug} (${intent.service_confidence.toFixed(2)}, via ${classifierSource}); location source=${intent.location.source}; time=${format(resolved, 'EEE HH:mm', { timeZone: TZ })}.`,
    status: 'ok',
  });

  return intent;
}
