/**
 * Conversational agent — single LLM with function calling.
 *
 * Replaces the old linear pipeline (Planner -> Intent -> Discovery -> Ranking ->
 * await_user). The model now has a conversation history, decides when to call
 * tools (search_providers, book_appointment, contact_places_provider), and
 * returns a natural-language reply alongside any UI artifacts (provider cards,
 * booking confirmations).
 *
 * Uses Gemini function calling natively. Falls back to a polite "set up the LLM
 * key" message if GOOGLE_GEMINI_API_KEY is missing.
 */
import { admin } from '@/lib/supabase/admin';
import { env, isGeminiConfigured } from '@/lib/env';
import { nextStepIndex } from '../trace';
import { runDiscovery } from './discovery';
import { runRanking } from './ranking';
import { runBookingPhaseA } from './booking';
import type { AgentContext, ProviderCandidate, RankedProvider } from '../types';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  artifacts?: ConversationArtifact[];
}

export interface ConversationInput {
  messages: ChatMessage[];
  user_id: string;
  user_location: {
    id: string;
    address_text: string;
    city: string | null;
    town_or_area: string | null;
    point: { lat: number; lng: number };
  };
  locale: 'en' | 'ur' | 'ur-Latn';
}

export type ConversationArtifact =
  | {
      type: 'providers';
      service_slug: string;
      requested_time_iso: string | null;
      bookable: RankedProvider[];
      also_nearby: RankedProvider[];
    }
  | {
      type: 'booking_confirmation';
      booking_id: string;
      provider_name: string;
      slot_iso: string;
      invitation_channel: string;
      complexity?: 'basic' | 'intermediate' | 'complex' | null;
      price_breakdown?: Record<string, unknown> | null;
    }
  | {
      type: 'places_contact_sent';
      place_id: string;
      booking_id?: string;
      slot_iso?: string;
      place_name: string;
      channel: 'sms' | 'email' | 'mock';
      message_body: string;
    }
  | {
      type: 'clarification';
      question: string;
      options: string[];
    }
  | {
      type: 'slot_suggestions';
      provider_id: string;
      provider_name: string;
      slots: Array<{ iso: string; label: string }>;
    };

export interface ConversationOutput {
  reply: string;
  artifacts: ConversationArtifact[];
}

// ---------------------------------------------------------------------------
// Tool declarations (Gemini function-calling schema)
// ---------------------------------------------------------------------------
const SERVICE_SLUGS = [
  'ac_repair', 'plumber', 'electrician', 'tutor', 'beautician', 'carpenter', 'car_wash', 'mobile_repair',
  'car_mechanic', 'house_cleaning', 'cook', 'painter', 'mason', 'appliance_repair', 'gardening', 'pest_control',
] as const;

const TOOL_DECLARATIONS = [
  {
    name: 'search_providers',
    description:
      'Find nearby service providers for the customer. Returns top bookable providers from our database plus nearby Google Places results. Call this when you have understood the service type the user needs.',
    parameters: {
      type: 'object',
      properties: {
        service_slug: { type: 'string', enum: SERVICE_SLUGS as unknown as string[], description: 'Closest matching service category.' },
        time_iso: { type: 'string', description: 'ISO datetime of when the user wants the service. Leave empty if unspecified.' },
        notes: { type: 'string', description: 'Any specific need extracted from the conversation (e.g. "water tank cleaning", "screen replacement").' },
        complexity: { type: 'string', enum: ['basic', 'intermediate', 'complex'], description: 'Job complexity. basic = single task, intermediate = 1-2 hours, complex = multi-hour / specialist. Drives matching + pricing.' },
        urgency: { type: 'string', enum: ['now', 'today', 'tomorrow', 'this_week'], description: 'How urgent the request is. Affects pricing.' },
        budget_preference: { type: 'string', enum: ['low', 'mid', 'high'], description: 'User budget preference if mentioned. low = sasta/cheap, high = best/premium.' },
      },
      required: ['service_slug'],
    },
  },
  {
    name: 'ask_clarification',
    description:
      'Ask the user a clarifying question with 2–4 quick-reply options. Use when the service category or critical detail is genuinely ambiguous. Do NOT use for simple confirmations — ask those in plain text.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Short clarifying question (≤ 80 chars).' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '2 to 4 short option labels the user can tap (e.g. ["AC cooling issue", "AC gas refill", "Other"]).',
        },
      },
      required: ['question', 'options'],
    },
  },
  {
    name: 'suggest_alternate_slots',
    description:
      'When the requested slot is unavailable for a provider, find the next 3 free time windows. Only call after a search_providers call has already returned bookable providers.',
    parameters: {
      type: 'object',
      properties: {
        provider_id: { type: 'string', description: 'UUID of the provider.' },
        preferred_slot_iso: { type: 'string', description: 'The originally requested slot (ISO 8601).' },
      },
      required: ['provider_id', 'preferred_slot_iso'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Confirm a booking with a registered SahuliatAI provider (those returned with source=self_onboarded). Only call when the user has explicitly chosen a provider AND a time. ALWAYS pass a concise "notes" string summarizing the user\'s problem/complaint as captured from the conversation so the provider arrives prepared.',
    parameters: {
      type: 'object',
      properties: {
        provider_id: { type: 'string', description: 'UUID of the provider as returned by search_providers (NOT a places:... id).' },
        slot_iso: { type: 'string', description: 'Appointment start time in ISO 8601.' },
        notes: {
          type: 'string',
          description:
            'Short (≤ 200 chars) summary of the customer\'s problem, written in the customer\'s language. Examples: "AC cooling nahi kar raha, gas issue lag raha hai", "Pipe leak in kitchen", "Water tank not cleaned in 6 months". Leave empty ONLY if the customer truly gave no context.',
        },
        complexity: { type: 'string', enum: ['basic', 'intermediate', 'complex'], description: 'Job complexity. basic = single task, intermediate = 1-2 hours, complex = multi-hour / specialist. Drives pricing.' },
        urgency: { type: 'string', enum: ['now', 'today', 'tomorrow', 'this_week'], description: 'How urgent the request is. Affects pricing.' },
      },
      required: ['provider_id', 'slot_iso'],
    },
  },
  {
    name: 'contact_places_provider',
    description:
      'Send a contact message to a Google Places provider (source=places_api, id starts with "places:"). Used when the user wants to contact a Google-listed business that is not in our database.',
    parameters: {
      type: 'object',
      properties: {
        place_id: { type: 'string', description: 'The full id from search_providers, e.g. "places:ChIJ...".' },
        business_name: { type: 'string' },
        requested_time: { type: 'string', description: 'When the user wants the service (human-readable).' },
        user_note: { type: 'string', description: 'Optional extra context to add to the message.' },
      },
      required: ['place_id', 'business_name', 'requested_time'],
    },
  },
];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(input: ConversationInput): string {
  const loc = input.user_location;
  const knownProviders = collectKnownProviders(input.messages);
  return [
    'You are SahuliatAI — a friendly, conversational MALE assistant who helps people in Pakistan book informal-economy services',
    '(plumbers, AC technicians, electricians, tutors, beauticians, carpenters, car wash, mobile repair).',
    '',
    'PERSONA:',
    '- You are a MALE assistant. In Urdu / Roman Urdu use masculine first-person verb forms — e.g. "main aapki madad kar SAKTA hoon" (NOT "sakti hoon"), "main ne dhoonda" (NOT "dhoondi"), "mujhe lagta hai" is fine. Sentences about yourself like "I can…", "I think…", "I found…" must be masculine.',
    '- Stay warm but professional, never flirtatious.',
    '',
    '🚨 NEVER LIE ABOUT TOOL CALLS — THIS IS THE MOST IMPORTANT RULE:',
    '- You are ONLY allowed to say things like "message bhej diya", "booking confirmed", "request sent", "contacted", "ho gaya", "send kar diya", "تیار ہے" etc. if you ACTUALLY called book_appointment or contact_places_provider in THIS turn AND received a success result.',
    '- If you do NOT have a concrete provider id (from the KNOWN PROVIDERS list below, or from a search_providers tool call YOU just made), you MUST NOT pretend you sent anything. Instead reply: "Pehle main aapke liye providers dhoondta hoon — ek minute" and call search_providers.',
    '- If you have the id but the user has not given a time yet, ASK for the time before calling the tool. Do not assume.',
    '- After a successful tool call, keep your text reply SHORT — the UI already renders a confirmation card with the booking id. Do NOT repeat the details.',
    '- If a tool call returns an error, tell the user honestly and offer the next step. Never paper over a failure.',
    '',
    'IMPORTANT BEHAVIOR:',
    '- Reply in the SAME language the user uses. Detect English / Urdu (اردو) / Roman Urdu and mirror it.',
    '- Be conversational, NOT robotic. Ask one short clarifying question if the problem is ambiguous (e.g. "AC cooling nahi kar raha ya leak ho raha hai?").',
    '- Once you understand the service category, call search_providers. Do NOT list providers manually — the tool returns them with structured data.',
    '- After search_providers returns, summarize the top options briefly in the conversation. Mention 1–2 specifically by name + distance.',
    '- Ask the user if they want to book one, or wait for them to say which.',
    '- When the user says "book X" or "X wale ko book kar do" or names a provider with a time → call book_appointment (for self_onboarded providers) or contact_places_provider (for places_api providers).',
    '- ALWAYS pass a "notes" field to book_appointment/contact_places_provider that summarizes the customer\'s actual problem (gathered during the conversation). This is what the provider will see — make it useful, not a restatement of the service category.',
    '- After a booking succeeds, briefly confirm in 1 sentence — don\'t repeat all the details, the UI shows a confirmation card.',
    '- Keep responses SHORT — 1 to 3 sentences ideal. The UI will render any cards or confirmations.',
    '',
    '⚠ CRITICAL — AVOID REDUNDANT TOOL CALLS:',
    '- DO NOT call search_providers if the conversation already contains a recent search_providers result and the user is now ACTING on those results (picking one, asking to book/contact, refining time, asking a question about a provider). Use the IDs and names already in your conversation history.',
    '- When you call book_appointment or contact_places_provider, DO NOT also call search_providers in the same turn — that would re-show the list unnecessarily.',
    '- Only call search_providers when the user genuinely starts a NEW search (different service category, different location, or explicitly says "find more").',
    '- If the user picked one provider but you don\'t have its id in history, ask them to clarify rather than re-searching.',
    '',
    `USER CONTEXT:`,
    `- Preferred locale: ${input.locale}`,
    `- Saved location: ${loc.address_text}${loc.town_or_area ? ` (${loc.town_or_area})` : ''}${loc.city ? `, ${loc.city}` : ''}`,
    `- Coordinates: ${loc.point.lat.toFixed(4)}, ${loc.point.lng.toFixed(4)}`,
    `- Current time (Asia/Karachi): ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}`,
    '',
    'AVAILABLE SERVICE CATEGORIES: ' + SERVICE_SLUGS.join(', '),
    '',
    'CATEGORY HINTS:',
    '- ac_repair: AC, cooling, gas refill (NOT fridge)',
    '- plumber: water tank cleaning, drainage, pipe leak',
    '- electrician: wiring, fan, light, switches, meter',
    '- tutor: tuition, teaching, ustad',
    '- beautician: hair, makeup, salon, threading',
    '- carpenter: furniture, wood work, almari',
    '- car_wash: car cleaning only (NOT mechanical repair)',
    '- car_mechanic: engine, brakes, clutch, gaari mechanical issues',
    '- mobile_repair: phone screen, battery',
    '- house_cleaning: home dusting, mopping, general saafai, maid',
    '- cook: khansama, daily meals, party catering',
    '- painter: wall painting, polish, distemper',
    '- mason: brick work, cement, plaster (raj mistri)',
    '- appliance_repair: fridge, washing machine, microwave (NOT AC, NOT mobile)',
    '- gardening: mali, lawn, plants, trees',
    '- pest_control: cockroach, termite, fumigation',
    '',
    'TIME PARSING HINTS (Roman Urdu):',
    '- "kal subah" = tomorrow morning ~9 AM',
    '- "kal shaam" = tomorrow evening ~5 PM',
    '- "aaj" = today',
    '- "abhi" = now',
    '- "parson" = day after tomorrow',
    'When the user gives a relative time, resolve to an ISO 8601 datetime in Asia/Karachi.',
    '',
    knownProviders ? 'KNOWN PROVIDERS FROM THIS CONVERSATION (use these EXACT ids when calling book_appointment / contact_places_provider — do NOT re-search):\n' + knownProviders : '',
  ].filter(Boolean).join('\n');
}

function collectKnownProviders(messages: ChatMessage[]): string {
  // Walk through history and accumulate all providers ever returned by search_providers.
  // We keep the latest snapshot per provider id.
  const seen = new Map<string, { name: string; source: string; service: string; phone?: string | null }>();
  for (const m of messages) {
    if (m.role !== 'model' || !m.artifacts) continue;
    for (const a of m.artifacts) {
      if ((a as { type?: string }).type !== 'providers') continue;
      const art = a as unknown as { service_slug: string; bookable: { id: string; business_name: string; source: 'self_onboarded' | 'places_api'; phone?: string | null }[]; also_nearby: { id: string; business_name: string; source: 'self_onboarded' | 'places_api'; phone?: string | null }[] };
      for (const p of [...(art.bookable ?? []), ...(art.also_nearby ?? [])]) {
        seen.set(p.id, {
          name: p.business_name,
          source: p.source,
          service: art.service_slug,
          phone: p.phone,
        });
      }
    }
  }
  if (seen.size === 0) return '';
  const lines: string[] = [];
  for (const [id, p] of seen) {
    const tool = p.source === 'places_api' ? 'contact_places_provider(place_id=' : 'book_appointment(provider_id=';
    lines.push(`  - ${p.name} [${p.service}] → ${tool}"${id}")`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------
interface ToolDispatchContext extends AgentContext {
  input: ConversationInput;
  artifacts: ConversationArtifact[];
  candidateMap: Map<string, RankedProvider>; // populated by search_providers, used by book/contact
  intentCache: {
    service_slug: string | null;
    time_iso: string | null;
    complexity?: 'basic' | 'intermediate' | 'complex';
    urgency?: 'now' | 'today' | 'tomorrow' | 'this_week';
  };
}

function inferUrgency(slotIso: string): 'now' | 'today' | 'tomorrow' | 'this_week' {
  const slot = new Date(slotIso).getTime();
  const now = Date.now();
  const hours = (slot - now) / (60 * 60 * 1000);
  if (hours < 3) return 'now';
  if (hours < 24) return 'today';
  if (hours < 48) return 'tomorrow';
  return 'this_week';
}

async function dispatchTool(call: { name: string; args: Record<string, unknown> }, ctx: ToolDispatchContext): Promise<unknown> {
  const args = call.args ?? {};
  switch (call.name) {
    case 'search_providers':
      return await toolSearchProviders(args as { service_slug: string; time_iso?: string; notes?: string; complexity?: 'basic' | 'intermediate' | 'complex'; urgency?: 'now' | 'today' | 'tomorrow' | 'this_week'; budget_preference?: 'low' | 'mid' | 'high' }, ctx);
    case 'book_appointment':
      return await toolBookAppointment(args as { provider_id: string; slot_iso: string; notes?: string; complexity?: 'basic' | 'intermediate' | 'complex'; urgency?: 'now' | 'today' | 'tomorrow' | 'this_week' }, ctx);
    case 'contact_places_provider':
      return await toolContactPlacesProvider(args as {
        place_id: string; business_name: string; requested_time: string; user_note?: string;
      }, ctx);
    case 'ask_clarification':
      return toolAskClarification(args as { question: string; options: string[] }, ctx);
    case 'suggest_alternate_slots':
      return await toolSuggestAlternateSlots(args as { provider_id: string; preferred_slot_iso: string }, ctx);
    default:
      return { error: `unknown tool: ${call.name}` };
  }
}

async function toolSearchProviders(
  args: { service_slug: string; time_iso?: string; notes?: string; complexity?: 'basic' | 'intermediate' | 'complex'; urgency?: 'now' | 'today' | 'tomorrow' | 'this_week'; budget_preference?: 'low' | 'mid' | 'high' },
  ctx: ToolDispatchContext,
): Promise<unknown> {
  const timeIso = args.time_iso || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  ctx.intentCache.service_slug = args.service_slug;
  ctx.intentCache.time_iso = timeIso;
  const complexity = args.complexity ?? 'basic';
  const urgency = args.urgency ?? inferUrgency(timeIso);

  const intent = {
    service_slug: args.service_slug,
    service_confidence: 0.9,
    location: {
      text: ctx.input.user_location.address_text,
      point: ctx.input.user_location.point,
      source: 'user_location' as const,
      confidence: 1,
    },
    time: { iso: timeIso, original_phrase: args.time_iso ?? '', confidence: 0.8 },
    urgency,
    notes: args.notes ?? '',
    complexity,
  };
  ctx.intentCache.complexity = complexity;
  ctx.intentCache.urgency = urgency;

  const disc = await runDiscovery({ intent }, ctx, await nextStep(ctx));
  const candidates: ProviderCandidate[] = disc.candidates;
  const ranked = await runRanking(
    {
      intent,
      candidates,
      user_location: { point: intent.location.point, address_text: intent.location.text },
      customer_user_id: ctx.input.user_id,
      complexity,
      budget_preference: args.budget_preference ?? null,
    },
    ctx,
    await nextStep(ctx),
  );

  // Cache for booking/contact lookups
  [...ranked.top, ...ranked.also_nearby].forEach((p) => ctx.candidateMap.set(p.id, p));

  ctx.artifacts.push({
    type: 'providers',
    service_slug: args.service_slug,
    requested_time_iso: timeIso,
    bookable: ranked.top,
    also_nearby: ranked.also_nearby.slice(0, 5),
  });

  // Compact summary for the LLM
  return {
    found_bookable: ranked.top.length,
    found_places: ranked.also_nearby.length,
    top_bookable: ranked.top.map((p) => ({
      id: p.id,
      name: p.business_name,
      distance_km: +(p.distance_m / 1000).toFixed(1),
      rating: p.portal_rating_count > 0 ? p.portal_rating : p.google_rating,
      portal_rating: p.portal_rating,
      portal_rating_count: p.portal_rating_count,
      google_rating: p.google_rating,
      score: p.score,
    })),
    top_places: ranked.also_nearby.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.business_name,
      distance_km: +(p.distance_m / 1000).toFixed(1),
      rating: p.google_rating || null,
    })),
    requested_time_iso: timeIso,
  };
}

async function toolBookAppointment(
  args: { provider_id: string; slot_iso: string; notes?: string; complexity?: 'basic' | 'intermediate' | 'complex'; urgency?: 'now' | 'today' | 'tomorrow' | 'this_week' },
  ctx: ToolDispatchContext,
): Promise<unknown> {
  if (args.provider_id.startsWith('places:')) {
    return { error: 'This is a Google Places provider — use contact_places_provider instead.' };
  }
  const complexity = args.complexity ?? ctx.intentCache.complexity ?? 'basic';
  const urgency = args.urgency ?? ctx.intentCache.urgency ?? inferUrgency(args.slot_iso);
  const serviceSlug = ctx.intentCache.service_slug ?? 'ac_repair';

  // Compute price BEFORE creating the booking so the breakdown is persisted on insert.
  let priceBreakdown: Record<string, unknown> | null = null;
  try {
    priceBreakdown = await ctx.callTool('compute_price', {
      provider_id: args.provider_id,
      service_slug: serviceSlug,
      slot_iso: args.slot_iso,
      user_point: ctx.input.user_location.point,
      complexity,
      urgency,
      customer_user_id: ctx.input.user_id,
    });
  } catch (e) {
    ctx.logger.warn('compute_price failed; proceeding without breakdown', e);
  }

  const out = await runBookingPhaseA(
    {
      user_id: ctx.input.user_id,
      user_location_id: ctx.input.user_location.id,
      provider_id: args.provider_id,
      slot_start: args.slot_iso,
      customer_lang: ctx.input.locale,
      notes: args.notes ?? '',
      complexity,
      price_breakdown: priceBreakdown,
    },
    ctx,
    await nextStep(ctx),
  );

  const provider = ctx.candidateMap.get(args.provider_id);
  const providerName = provider?.business_name ?? 'the provider';

  ctx.artifacts.push({
    type: 'booking_confirmation',
    booking_id: out.booking_id,
    provider_name: providerName,
    slot_iso: args.slot_iso,
    invitation_channel: out.invitation_channel,
    complexity,
    price_breakdown: priceBreakdown,
  });

  return {
    success: true,
    booking_id: out.booking_id,
    provider_name: providerName,
    invitation_channel: out.invitation_channel,
    next: 'Provider will be notified. Customer will see the confirmation card.',
  };
}

async function toolContactPlacesProvider(
  args: { place_id: string; business_name: string; requested_time: string; user_note?: string },
  ctx: ToolDispatchContext,
): Promise<unknown> {
  // Strip the "places:" prefix we use internally — the Postgres row stores
  // just the raw Google Place id.
  const placesId = args.place_id.startsWith('places:') ? args.place_id.slice(7) : args.place_id;
  const candidate = ctx.candidateMap.get(args.place_id);
  const serviceSlug = ctx.intentCache.service_slug ?? 'service';

  // 1) Upsert a ghost provider so we can hang a real booking off it.
  const { data: ghostId, error: upsertErr } = await admin.rpc('upsert_places_provider', {
    p_place_id: placesId,
    p_business_name: args.business_name,
    p_phone: candidate?.phone ?? null,
    p_lat: candidate?.hub_lat ?? null,
    p_lng: candidate?.hub_lng ?? null,
    p_categories: [serviceSlug],
  });
  if (upsertErr || !ghostId) {
    ctx.logger.warn('upsert_places_provider failed', upsertErr);
    return { error: `could not register provider: ${upsertErr?.message ?? 'unknown'}` };
  }
  const ghostProviderId = ghostId as unknown as string;

  // 2) Resolve requested time → ISO. LLM should send ISO but be forgiving.
  const slotStart = (() => {
    const d = new Date(args.requested_time);
    if (!isNaN(d.getTime())) return d;
    const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
  })();
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

  // 3) Create the booking with status='query_sent'.
  let bookingId: string;
  let invitationToken: string;
  try {
    const created = await ctx.callTool<{ booking_id: string; invitation_token: string }>(
      'supabase.create_booking',
      {
        customer_user_id: ctx.input.user_id,
        customer_user_location_id: ctx.input.user_location.id,
        provider_id: ghostProviderId,
        service_category: serviceSlug,
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        location_text: ctx.input.user_location.address_text,
        location_point: ctx.input.user_location.point,
        customer_lang: ctx.input.locale,
        agent_run_id: ctx.runId,
        notes: args.user_note ?? '',
      },
    );
    bookingId = created.booking_id;
    invitationToken = created.invitation_token;
  } catch (e) {
    ctx.logger.warn('create_booking (query_sent) failed', e);
    return { error: (e as Error).message };
  }

  // create_booking defaults to status='invitation_sent'; flip to query_sent.
  await admin.from('bookings').update({ status: 'query_sent' }).eq('id', bookingId);

  // 4) Render the message with the tokenized accept link + join-CTA footer.
  const { data: profile } = await admin
    .from('users_profile')
    .select('display_name')
    .eq('user_id', ctx.input.user_id)
    .maybeSingle();
  const customerName = profile?.display_name ?? 'a SahuliatAI customer';
  const channel: 'sms' | 'mock' = candidate?.phone ? 'sms' : 'mock';
  const recipient = candidate?.phone ?? 'unknown';
  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/provider/accept/${invitationToken}`;
  const messageBody = [
    `Hi ${args.business_name},`,
    '',
    `${customerName} is requesting your service via SahuliatAI:`,
    `  Service: ${prettyService(serviceSlug)}`,
    `  When: ${slotStart.toLocaleString()}`,
    args.user_note ? `  Note: ${args.user_note}` : null,
    '',
    `Tap to accept: ${acceptUrl}`,
    '',
    '———',
    `📲 Manage all your bookings here — join SahuliatAI:`,
    `   ${env.NEXT_PUBLIC_APP_URL}/for-business?ref=${placesId}`,
    `   Real-time invitations from customers near you. No extra app needed.`,
  ].filter(Boolean).join('\n');

  try {
    await admin.from('mock_messages').insert({
      booking_id: bookingId,
      channel: 'whatsapp',
      to_phone: recipient,
      body: messageBody,
      accept_url: acceptUrl,
    });
  } catch (e) {
    ctx.logger.warn('mock_messages persist skipped', e);
  }
  try {
    await admin.from('places_contacts').insert({
      user_id: ctx.input.user_id,
      place_id: placesId,
      business_name: args.business_name,
      channel,
      recipient,
      body: messageBody,
    });
  } catch (e) {
    ctx.logger.warn('places_contacts persist skipped', e);
  }

  await admin.from('bookings').update({ invitation_channel: channel }).eq('id', bookingId);

  ctx.artifacts.push({
    type: 'places_contact_sent',
    place_id: args.place_id,
    place_name: args.business_name,
    channel,
    message_body: messageBody,
    booking_id: bookingId,
    slot_iso: slotStart.toISOString(),
  });

  return {
    success: true,
    booking_id: bookingId,
    channel,
    recipient,
    next: 'Booking created with status=query_sent and message sent. Visible in My Bookings. If the provider joins via ?ref=, they will see this in their dashboard.',
  };
}

function toolAskClarification(
  args: { question: string; options: string[] },
  ctx: ToolDispatchContext,
): unknown {
  ctx.artifacts.push({ type: 'clarification', question: args.question, options: args.options.slice(0, 4) });
  return { status: 'question_shown', options_count: args.options.length };
}

async function toolSuggestAlternateSlots(
  args: { provider_id: string; preferred_slot_iso: string },
  ctx: ToolDispatchContext,
): Promise<unknown> {
  const preferredStart = new Date(args.preferred_slot_iso);
  const slotDurationMs = 60 * 60 * 1000; // 1-hour windows

  // Check up to 12 hourly windows starting from the preferred slot.
  const candidates: Array<{ iso: string; label: string }> = [];
  for (let h = 1; h <= 12 && candidates.length < 3; h++) {
    const start = new Date(preferredStart.getTime() + h * slotDurationMs);
    const end = new Date(start.getTime() + slotDurationMs);
    try {
      const avail = await admin
        .rpc('check_availability_rpc', {
          p_provider_id: args.provider_id,
          p_slot_start: start.toISOString(),
          p_slot_end: end.toISOString(),
        })
        .maybeSingle<{ available: boolean }>();
      if (avail.data?.available !== false) {
        candidates.push({
          iso: start.toISOString(),
          label: start.toLocaleString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'short', hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch {
      // RPC not available; just include slot anyway
      candidates.push({
        iso: start.toISOString(),
        label: start.toLocaleString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'short', hour: '2-digit', minute: '2-digit' }),
      });
    }
  }

  const providerName = ctx.candidateMap.get(args.provider_id)?.business_name ?? 'the provider';
  if (candidates.length > 0) {
    ctx.artifacts.push({
      type: 'slot_suggestions',
      provider_id: args.provider_id,
      provider_name: providerName,
      slots: candidates,
    });
  }

  return {
    found: candidates.length,
    slots: candidates,
    message: candidates.length > 0
      ? `Found ${candidates.length} available slots for ${providerName}.`
      : `No free slots found in the next 12 hours for ${providerName}.`,
  };
}

function prettyService(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function nextStep(ctx: ToolDispatchContext): Promise<number> {
  return nextStepIndex(ctx.runId);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function runConversation(input: ConversationInput, ctx: AgentContext): Promise<ConversationOutput> {
  if (!isGeminiConfigured()) {
    return {
      reply:
        "I'd love to chat, but my LLM isn't connected yet. Please set GOOGLE_GEMINI_API_KEY in .env.local and restart, then I can help you find a service provider. (You can also describe what you need and the system will fall back to keyword matching.)",
      artifacts: [],
    };
  }

  await ctx.emitTrace({
    runId: ctx.runId,
    agentName: 'planner',
    stepIndex: 0,
    startedAt: new Date().toISOString(),
    inputs: { messages: input.messages.length, locale: input.locale },
    status: 'running',
  });

  const { GoogleGenerativeAI, SchemaType } = (await import('@google/generative-ai')) as unknown as {
    GoogleGenerativeAI: new (key: string) => { getGenerativeModel: (cfg: Record<string, unknown>) => unknown };
    SchemaType: { OBJECT: string; STRING: string; ARRAY: string };
  };

  const client = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY!);

  type GeminiCall = { name: string; args: Record<string, unknown> };
  type GeminiPart = { text?: string; functionCall?: GeminiCall; functionResponse?: unknown };
  type GeminiContent = { role: 'user' | 'model' | 'function'; parts: GeminiPart[] };

  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: { role: 'system', parts: [{ text: buildSystemPrompt(input) }] },
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  }) as unknown as {
    generateContent: (req: { contents: GeminiContent[] }) => Promise<{
      response: { candidates?: Array<{ content: GeminiContent }>; text: () => string };
    }>;
  };
  // SchemaType referenced for compile-only typing if needed
  void SchemaType;

  // Build conversation history → Gemini format.
  const contents: GeminiContent[] = input.messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const artifacts: ConversationArtifact[] = [];
  const candidateMap = new Map<string, RankedProvider>();
  // Rehydrate candidate map from any earlier providers artifacts in this thread
  // so book_appointment / contact_places_provider can resolve ids the user
  // references multiple turns after the original search.
  let rehydratedServiceSlug: string | null = null;
  for (const m of input.messages) {
    if (m.role !== 'model' || !m.artifacts) continue;
    for (const a of m.artifacts) {
      if ((a as { type?: string }).type !== 'providers') continue;
      const art = a as Extract<ConversationArtifact, { type: 'providers' }>;
      rehydratedServiceSlug = art.service_slug ?? rehydratedServiceSlug;
      for (const p of [...(art.bookable ?? []), ...(art.also_nearby ?? [])]) {
        candidateMap.set(p.id, p);
      }
    }
  }
  const intentCache = { service_slug: rehydratedServiceSlug, time_iso: null as string | null };
  const toolCtx: ToolDispatchContext = {
    ...ctx,
    input,
    artifacts,
    candidateMap,
    intentCache,
  };

  // Tool-call loop — cap iterations to avoid runaway.
  let iterations = 0;
  const MAX_ITERATIONS = 6;
  let replyText = '';

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const result = await model.generateContent({ contents });
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls: GeminiCall[] = parts.filter((p) => !!p.functionCall).map((p) => p.functionCall!) as GeminiCall[];
    const textParts = parts.filter((p) => typeof p.text === 'string' && p.text.length > 0).map((p) => p.text!);

    if (calls.length === 0) {
      replyText = textParts.join('\n').trim() || result.response.text();
      break;
    }

    // Push the assistant's tool-call turn into history
    contents.push({ role: 'model', parts });

    // Run each tool call, push function responses
    const responseParts: GeminiPart[] = [];
    for (const call of calls) {
      ctx.logger.tool(`conversation:${call.name}`, call.args);
      let toolResult: unknown;
      try {
        toolResult = await dispatchTool(call, toolCtx);
      } catch (e) {
        toolResult = { error: (e as Error).message };
        ctx.logger.warn(`tool ${call.name} threw`, e);
      }
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: { result: toolResult },
        },
      });
    }
    contents.push({ role: 'function', parts: responseParts });
  }

  if (!replyText) {
    // Better fallback that doesn't make the user feel they have to start over —
    // acknowledge what we last did and ask one short clarifying question.
    const lastAction = artifacts[artifacts.length - 1]?.type;
    if (lastAction === 'booking_confirmation' || lastAction === 'places_contact_sent') {
      replyText = 'Done — your request has been sent. Aap ko aur kuch chahiye?';
    } else if (lastAction === 'providers') {
      replyText = 'Yeh providers mil gaye hain. Aap kis ko book karna chahenge — naam batayein ya time bhi share kar dein.';
    } else {
      replyText = 'Maaf kijiye, main thora confuse ho gaya. Kya aap dobara likh sakte hain — kis service ki zaroorat hai aur kab?';
    }
  }

  // 🚨 Hallucination guard — if the model claims success but no real action
  // happened in this run, rewrite the reply so we don't lie to the user.
  const claimsSuccess = /(\bbooked\b|\bbook(ing)? confirmed\b|\bsent\b|\bcontacted\b|\bdispatched\b|bhej(?: di(?:ya|i)|d?diya|d?dia)|ho gay(a|i)|ho gaya hai|send kar di(?:ya|a)|نے بھیج|بھیج دیا|تیار ہے)/i.test(replyText);
  const didAction = artifacts.some(
    (a) => a.type === 'booking_confirmation' || a.type === 'places_contact_sent',
  );
  if (claimsSuccess && !didAction) {
    ctx.logger.warn('hallucination guard tripped — reply claimed success but no action artifact emitted', { replyText });
    const lastSearch = artifacts.find((a) => a.type === 'providers');
    if (lastSearch || candidateMap.size > 0) {
      replyText = 'Maaf kijiye, mujhse galti hui — actually message abhi tak nahi gaya. Kya aap provider ka naam aur time confirm karein ge taakay main abhi bhej doon?';
    } else {
      replyText = 'Maaf kijiye, mujhse galti hui — actually request abhi tak nahi gayi. Pehle main aapke liye providers dhoondta hoon — service aur location confirm karein.';
    }
  }

  // Defensive: if the model called search_providers AND an action tool
  // (book_appointment / contact_places_provider) in the same turn, suppress
  // the redundant provider list. The user just picked one — they don't need
  // to see the list again.
  const hasAction = artifacts.some(
    (a) => a.type === 'booking_confirmation' || a.type === 'places_contact_sent',
  );
  const trimmedArtifacts = hasAction
    ? artifacts.filter((a) => a.type !== 'providers')
    : artifacts;

  await ctx.emitTrace({
    runId: ctx.runId,
    agentName: 'planner',
    stepIndex: 0,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    outputs: {
      iterations,
      tool_calls: artifacts.length,
      artifacts_shown: trimmedArtifacts.length,
      reply_length: replyText.length,
    },
    reasoning: `Conversation turn completed in ${iterations} iterations; ${artifacts.length} artifact(s) emitted${trimmedArtifacts.length !== artifacts.length ? `, ${artifacts.length - trimmedArtifacts.length} suppressed (action + search collapsed)` : ''}.`,
    status: 'ok',
  });

  return { reply: replyText, artifacts: trimmedArtifacts };
}
