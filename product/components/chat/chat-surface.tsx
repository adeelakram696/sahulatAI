'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MapPin, ArrowUp, Plus, RotateCcw, Navigation } from 'lucide-react';
import PlacesContactDialog from '@/components/recommendations/places-contact-dialog';
import { PriceBreakdownCard, type PriceBreakdown } from '@/components/booking/booking-realtime';
import { BrandIcon } from '@/components/ui/brand-mark';
import { RatingBadges } from '@/components/ui/rating-badges';

type Location = { id: string; label: string; address_text: string; city: string | null; town_or_area: string | null };

type Provider = {
  id: string;
  business_name: string;
  distance_m: number;
  google_rating: number;
  google_rating_count: number;
  portal_rating: number;
  portal_rating_count: number;
  reasoning?: { en: string; ur: string };
  is_bookable: boolean;
  score?: number;
  source?: 'self_onboarded' | 'places_api';
  phone?: string | null;
  website?: string | null;
  google_maps_url?: string | null;
};

type Artifact =
  | { type: 'providers'; service_slug: string; requested_time_iso: string | null; bookable: Provider[]; also_nearby: Provider[] }
  | { type: 'booking_confirmation'; booking_id: string; provider_name: string; slot_iso: string; invitation_channel: string; complexity?: string | null; price_breakdown?: PriceBreakdown | null }
  | { type: 'places_contact_sent'; place_id: string; place_name: string; channel: string; message_body: string; booking_id?: string; slot_iso?: string }
  | { type: 'clarification'; question: string; options: string[] }
  | { type: 'slot_suggestions'; provider_id: string; provider_name: string; slots: Array<{ iso: string; label: string }> };

type ChatTurn =
  | { role: 'user'; content: string }
  | { role: 'model'; content: string; artifacts?: Artifact[] };

const SUGGESTIONS = [
  { lang: 'Roman Urdu', text: 'Mujhe tank clean karwana hai' },
  { lang: 'English', text: 'I need a plumber tomorrow morning' },
  { lang: 'Urdu', text: 'مجھے کل صبح ٹیوٹر چاہیے' },
  { lang: 'Roman Urdu', text: 'AC me cooling nahi kar raha' },
];

const STORAGE_VERSION = 'v1';
function storageKey(userId: string) { return `sahuliat:chat:${STORAGE_VERSION}:${userId}`; }
const MAX_PERSISTED_TURNS = 40;

interface PersistedState { turns: ChatTurn[]; selectedLocId: string; updatedAt: number }

function loadPersisted(userId: string): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch { return null; }
}

function savePersisted(userId: string, state: PersistedState) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(state)); } catch {}
}

function clearPersisted(userId: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(storageKey(userId)); } catch {}
}

export default function ChatSurface({
  userId,
  locations,
  prefilledQuery,
  prefilledSlug: _prefilledSlug,
  autosubmit,
}: {
  userId: string;
  locations: Location[];
  prefilledQuery?: string;
  prefilledSlug?: string;
  autosubmit?: boolean;
}) {
  const [selectedLocId, setSelectedLocId] = useState(locations[0].id);
  const [input, setInput] = useState(prefilledQuery ?? '');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    const restored = loadPersisted(userId);
    if (restored) {
      setTurns(restored.turns);
      if (locations.some((l) => l.id === restored.selectedLocId)) {
        setSelectedLocId(restored.selectedLocId);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const trimmed = turns.slice(-MAX_PERSISTED_TURNS);
    savePersisted(userId, { turns: trimmed, selectedLocId, updatedAt: Date.now() });
  }, [turns, selectedLocId, hydrated, userId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  useEffect(() => {
    if (!hydrated) return;
    if (autosubmit && prefilledQuery && !autoSentRef.current) {
      autoSentRef.current = true;
      send(prefilledQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function clearChat() {
    setTurns([]);
    clearPersisted(userId);
  }

  async function send(text: string) {
    if (!text.trim() || pending) return;
    const userTurn: ChatTurn = { role: 'user', content: text };
    const next = [...turns, userTurn];
    setTurns(next);
    setInput('');
    setPending(true);
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((t) => t.role === 'model'
            ? { role: t.role, content: t.content, artifacts: t.artifacts ?? [] }
            : { role: t.role, content: t.content },
          ),
          selected_location_id: selectedLocId,
          locale: 'ur-Latn',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { reply: string; artifacts?: Artifact[]; error?: string };
      if (data.error) throw new Error(data.error);
      setTurns((prev) => [...prev, { role: 'model', content: data.reply, artifacts: data.artifacts ?? [] }]);
    } catch (e) {
      toast.error((e as Error).message || 'Something went wrong');
      setTurns((prev) => [...prev, { role: 'model', content: "Sorry — that didn't go through. Please try again." }]);
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocId)!;

  return (
    <div className="relative flex flex-col overflow-hidden h-[calc(100dvh_-_57px_-_60px)] md:h-[calc(100dvh_-_57px)]">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.12),transparent_70%)] blur-3xl -z-10"
      />

      {/* Location bar */}
      <div className="relative border-b border-border/60 bg-background/90 backdrop-blur-sm shrink-0">
        <div className="container max-w-3xl py-2 flex items-center justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <LocationChip locations={locations} selectedId={selectedLocId} onChange={setSelectedLocId} selected={selectedLocation} />
          </div>
          {turns.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-lg border border-border px-2 py-1.5 hover:bg-accent transition-colors shrink-0"
            >
              <RotateCcw className="size-3" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <main className="container max-w-3xl py-6 pb-4">
          {turns.length === 0 ? (
            <Empty onPickSuggestion={(s) => { setInput(s); inputRef.current?.focus(); }} />
          ) : (
            <div className="space-y-5">
              {turns.map((t, i) => (
                <TurnView key={i} turn={t} onChipSelect={send} isLast={i === turns.length - 1} pending={pending} />
              ))}
              {pending && <ThinkingBubble />}
            </div>
          )}
        </main>
      </div>

      {/* Input footer */}
      <footer className="relative border-t border-border/60 bg-background/95 backdrop-blur-md shrink-0">
        <div className="container max-w-3xl py-2.5 sm:py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card shadow-sm px-3 sm:px-4 py-2 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-primary-sm transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={pending ? 'Thinking…' : 'Describe what you need…'}
              disabled={pending}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[14px] placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 py-1.5 max-h-32"
            />
            <button
              onClick={() => send(input)}
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="size-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0 shadow-primary-sm disabled:opacity-40 disabled:shadow-none hover:opacity-90 active:scale-95 transition-all mb-0.5"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-1.5 hidden sm:block">
            Enter to send · Shift+Enter for new line · Urdu, Roman Urdu &amp; English
          </p>
        </div>
      </footer>
    </div>
  );
}

function Empty({ onPickSuggestion }: { onPickSuggestion: (s: string) => void }) {
  return (
    <div className="text-center py-10 sm:py-14 space-y-6 animate-fade-in">
      <div className="inline-flex shadow-primary-sm rounded-2xl">
        <BrandIcon size="lg" />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
          SahuliatAI
        </p>
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground">
          What do you need help with?
        </h2>
        <p className="text-[13.5px] sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Describe your problem in any language. I&apos;ll ask follow-ups, find the right provider, and book it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg mx-auto text-left">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => onPickSuggestion(s.text)}
            className="group rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-md active:scale-[0.98] px-4 py-3 text-left transition-all shadow-xs"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">{s.lang}</span>
            <p className="text-[13.5px] text-foreground mt-1 group-hover:text-primary transition-colors leading-snug">{s.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationChip({ locations, selectedId, onChange }: {
  locations: Location[]; selectedId: string; onChange: (id: string) => void; selected: Location;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <MapPin className="size-3.5 text-primary shrink-0" />
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer min-w-0 flex-1 truncate"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label} — {l.town_or_area || l.city || l.address_text.slice(0, 24)}
          </option>
        ))}
      </select>
      <Link href="/profile/locations" className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5 shrink-0">
        <Plus className="size-3" />
        <span className="hidden sm:inline">Add</span>
      </Link>
    </div>
  );
}

function TurnView({ turn, onChipSelect, isLast, pending }: { turn: ChatTurn; onChipSelect: (s: string) => void; isLast: boolean; pending: boolean }) {
  const showChips = isLast && !pending;

  if (turn.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 max-w-[80%] shadow-primary-sm">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2.5 animate-fade-in">
      <BrandIcon size="sm" className="mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2.5">
        {turn.content && (
          <div className="rounded-2xl rounded-tl-md bg-card border border-border px-4 py-2.5 shadow-xs">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{turn.content}</p>
          </div>
        )}
        {turn.artifacts?.map((a, i) => (
          <ArtifactView key={i} artifact={a} onChipSelect={showChips ? onChipSelect : undefined} />
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start gap-2.5 animate-fade-in">
      <BrandIcon size="sm" className="opacity-70" />
      <div className="rounded-2xl rounded-tl-md bg-card border border-border px-4 py-3 shadow-xs inline-flex items-center gap-1.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="inline-block size-2 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${delay}ms`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  );
}

function ArtifactView({ artifact, onChipSelect }: { artifact: Artifact; onChipSelect?: (s: string) => void }) {
  if (artifact.type === 'providers') return <ProvidersArtifact a={artifact} onBook={onChipSelect} />;
  if (artifact.type === 'booking_confirmation') return <BookingConfirmedArtifact a={artifact} />;
  if (artifact.type === 'places_contact_sent') return <PlacesContactSentArtifact a={artifact} />;
  if (artifact.type === 'clarification') return <ClarificationArtifact a={artifact} onSelect={onChipSelect} />;
  if (artifact.type === 'slot_suggestions') return <SlotSuggestionsArtifact a={artifact} onSelect={onChipSelect} />;
  return null;
}

function ProvidersArtifact({ a, onBook }: { a: Extract<Artifact, { type: 'providers' }>; onBook?: (msg: string) => void }) {
  return (
    <div className="space-y-3">
      {a.bookable.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
            Bookable through SahuliatAI
          </p>
          {a.bookable.map((p) => <ProviderCard key={p.id} p={p} serviceSlug={a.service_slug} requestedTimeIso={a.requested_time_iso} onBook={onBook} />)}
        </div>
      )}
      {a.also_nearby.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Also nearby · via Google
          </p>
          {a.also_nearby.map((p) => <ProviderCard key={p.id} p={p} serviceSlug={a.service_slug} requestedTimeIso={a.requested_time_iso} onBook={onBook} />)}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ p, serviceSlug, requestedTimeIso, onBook }: { p: Provider; serviceSlug: string; requestedTimeIso: string | null; onBook?: (msg: string) => void }) {
  const [contactOpen, setContactOpen] = useState(false);
  const distanceKm = (p.distance_m / 1000).toFixed(1);
  const isFromGoogle = p.source === 'places_api';
  const requestedTime = requestedTimeIso ? new Date(requestedTimeIso).toLocaleString() : 'soon';

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs hover:shadow-sm hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground">{p.business_name}</h3>
            {isFromGoogle && (
              <span className="text-[9px] uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5 text-muted-foreground font-medium">
                Google
              </span>
            )}
            {!isFromGoogle && p.score !== undefined && p.score >= 70 && (
              <span className="text-[9px] uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 px-1.5 py-0.5 font-semibold">
                Top match
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Navigation className="size-3 text-primary/60" />
              {distanceKm} km
            </span>
            <RatingBadges
              portalRating={p.portal_rating}
              portalCount={p.portal_rating_count}
              googleRating={p.google_rating}
            />
          </div>

          {p.reasoning && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.reasoning.en}</p>
          )}
        </div>

        {isFromGoogle ? (
          <button
            onClick={() => setContactOpen(true)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent hover:border-primary/30 transition-all"
          >
            Contact
          </button>
        ) : (
          <button
            onClick={() => onBook?.(`Book ${p.business_name}${requestedTimeIso ? ` at ${requestedTime}` : ''}`)}
            className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            Book
          </button>
        )}
      </div>

      {isFromGoogle && (p.phone || p.google_maps_url) && (
        <div className="mt-2.5 pt-2.5 border-t border-border/60 flex gap-4 text-[11px]">
          {p.phone && (
            <a href={`tel:${p.phone}`} className="text-primary hover:underline font-medium">
              📞 {p.phone}
            </a>
          )}
          {p.google_maps_url && (
            <a href={p.google_maps_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              View on Google ↗
            </a>
          )}
        </div>
      )}


      {isFromGoogle && (
        <PlacesContactDialog
          open={contactOpen} onClose={() => setContactOpen(false)}
          provider={{ id: p.id, business_name: p.business_name, phone: p.phone, website: p.website, google_maps_url: p.google_maps_url }}
          serviceCategory={serviceSlug} requestedTime={requestedTime}
        />
      )}
    </div>
  );
}

function BookingConfirmedArtifact({ a }: { a: Extract<Artifact, { type: 'booking_confirmation' }> }) {
  const slot = new Date(a.slot_iso).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/15 p-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="size-4 text-white" aria-hidden>
              <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
              Invitation sent to {a.provider_name}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              {slot} · via <span className="font-semibold uppercase">{a.invitation_channel}</span>
            </p>
            <Link
              href={`/booking/${a.booking_id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:underline mt-2"
            >
              Track this booking →
            </Link>
          </div>
        </div>
      </div>
      {a.price_breakdown && (
        <PriceBreakdownCard breakdown={a.price_breakdown} complexity={a.complexity} compact />
      )}
    </div>
  );
}

function ClarificationArtifact({ a, onSelect }: { a: Extract<Artifact, { type: 'clarification' }>; onSelect?: (s: string) => void }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{a.question}</p>
      <div className="flex flex-wrap gap-2">
        {a.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect?.(opt)}
            disabled={!onSelect}
            className="rounded-full border border-primary/30 bg-background text-primary px-3.5 py-1.5 text-xs font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 transition-all shadow-xs"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SlotSuggestionsArtifact({ a, onSelect }: { a: Extract<Artifact, { type: 'slot_suggestions' }>; onSelect?: (s: string) => void }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/15 p-4 space-y-3">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        That slot isn&apos;t available — here are the next free times for {a.provider_name}:
      </p>
      <div className="flex flex-wrap gap-2">
        {a.slots.map((slot) => (
          <button
            key={slot.iso}
            onClick={() => onSelect?.(`Book ${a.provider_name} at ${slot.label}`)}
            disabled={!onSelect}
            className="rounded-full border border-amber-300 bg-white dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 px-3.5 py-1.5 text-xs font-semibold hover:bg-amber-400 hover:text-white hover:border-amber-400 disabled:opacity-50 transition-all shadow-xs"
          >
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlacesContactSentArtifact({ a }: { a: Extract<Artifact, { type: 'places_contact_sent' }> }) {
  const slot = a.slot_iso ? new Date(a.slot_iso).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/15 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="size-4 text-white" aria-hidden>
            <path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="m2 4 6 5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-violet-900 dark:text-violet-100">
            Request sent to {a.place_name}
          </p>
          <p className="text-xs text-violet-700 dark:text-violet-300 mt-0.5">
            {slot && <>{slot} · </>}Via <span className="font-semibold uppercase">{a.channel}</span>
          </p>
          {a.booking_id && (
            <Link href={`/booking/${a.booking_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-800 dark:text-violet-200 hover:underline mt-2">
              Track this request →
            </Link>
          )}
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium select-none">Preview the message</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-background border border-border rounded-lg p-3">
{a.message_body}
        </pre>
      </details>
    </div>
  );
}
