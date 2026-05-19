'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import PlacesContactDialog from '@/components/recommendations/places-contact-dialog';
import { PriceBreakdownCard, type PriceBreakdown } from '@/components/booking/booking-realtime';

type Location = { id: string; label: string; address_text: string; city: string | null; town_or_area: string | null };

type Provider = {
  id: string;
  business_name: string;
  distance_m: number;
  rating_avg: number;
  rating_count: number;
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
  } catch {
    return null;
  }
}

function savePersisted(userId: string, state: PersistedState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Quota or serialization error — ignore.
  }
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
  const autoSentRef = useRef(false);

  // Restore persisted state on mount
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

  // Persist on every change (cap to last MAX_PERSISTED_TURNS)
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

  const selectedLocation = locations.find((l) => l.id === selectedLocId)!;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-57px-64px)] md:min-h-[calc(100dvh-57px)]">
      <div className="border-b border-border bg-background sticky top-[57px] z-[5]">
        <div className="container max-w-3xl py-2.5 flex items-center justify-between gap-3">
          <LocationChip locations={locations} selectedId={selectedLocId} onChange={setSelectedLocId} selected={selectedLocation} />
          {turns.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[11px] text-muted-foreground hover:text-foreground rounded-md border border-border px-2 py-1"
            >
              New chat
            </button>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <main className="container max-w-3xl py-6">
          {turns.length === 0 ? (
            <Empty onPickSuggestion={(s) => setInput(s)} />
          ) : (
            <div className="space-y-4">
              {turns.map((t, i) => <TurnView key={i} turn={t} onChipSelect={send} isLast={i === turns.length - 1} pending={pending} />)}
              {pending && <ThinkingBubble />}
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-border bg-background sticky bottom-0">
        <div className="container max-w-3xl py-3">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={pending ? 'Thinking…' : 'Describe what you need, or reply to the assistant…'}
              disabled={pending}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm"
            />
            <button type="submit" disabled={pending || !input.trim()}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

function Empty({ onPickSuggestion }: { onPickSuggestion: (s: string) => void }) {
  return (
    <div className="text-center py-16 space-y-6">
      <h2 className="text-2xl font-semibold">What service do you need?</h2>
      <p className="text-sm text-muted-foreground">
        Describe the problem in any language. I&apos;ll ask follow-ups, find the right provider, and book it.
      </p>
      <div className="space-y-2 max-w-md mx-auto">
        {SUGGESTIONS.map((s) => (
          <button key={s.text} onClick={() => onPickSuggestion(s.text)}
            className="block w-full text-left rounded-md border border-border px-4 py-3 hover:bg-accent transition">
            <span className="text-xs text-muted-foreground">{s.lang}</span>
            <p className="text-sm mt-0.5">{s.text}</p>
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
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">From:</span>
      <select value={selectedId} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm">
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label} — {l.town_or_area || l.city || l.address_text.slice(0, 24)}
          </option>
        ))}
      </select>
      <Link href="/profile/locations" className="text-xs text-muted-foreground hover:underline ml-1">+ Add</Link>
    </div>
  );
}

function TurnView({ turn, onChipSelect, isLast, pending }: { turn: ChatTurn; onChipSelect: (s: string) => void; isLast: boolean; pending: boolean }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
        </div>
      </div>
    );
  }
  // Only show interactive chips on the last model turn and when not awaiting a response.
  const showChips = isLast && !pending;
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-3">
        {turn.content && (
          <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-2">
            <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
          </div>
        )}
        {turn.artifacts?.map((a, i) => <ArtifactView key={i} artifact={a} onChipSelect={showChips ? onChipSelect : undefined} />)}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-2 inline-flex gap-1">
        <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse" />
        <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function ArtifactView({ artifact, onChipSelect }: { artifact: Artifact; onChipSelect?: (s: string) => void }) {
  if (artifact.type === 'providers') return <ProvidersArtifact a={artifact} />;
  if (artifact.type === 'booking_confirmation') return <BookingConfirmedArtifact a={artifact} />;
  if (artifact.type === 'places_contact_sent') return <PlacesContactSentArtifact a={artifact} />;
  if (artifact.type === 'clarification') return <ClarificationArtifact a={artifact} onSelect={onChipSelect} />;
  if (artifact.type === 'slot_suggestions') return <SlotSuggestionsArtifact a={artifact} onSelect={onChipSelect} />;
  return null;
}

function ProvidersArtifact({ a }: { a: Extract<Artifact, { type: 'providers' }> }) {
  return (
    <div className="space-y-3">
      {a.bookable.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Top {a.bookable.length} — bookable through SahuliatAI
          </p>
          {a.bookable.map((p) => <ProviderCard key={p.id} p={p} serviceSlug={a.service_slug} requestedTimeIso={a.requested_time_iso} />)}
        </div>
      )}
      {a.also_nearby.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Also nearby (via Google) — top {a.also_nearby.length}
          </p>
          {a.also_nearby.map((p) => <ProviderCard key={p.id} p={p} serviceSlug={a.service_slug} requestedTimeIso={a.requested_time_iso} />)}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ p, serviceSlug, requestedTimeIso }: { p: Provider; serviceSlug: string; requestedTimeIso: string | null }) {
  const [contactOpen, setContactOpen] = useState(false);
  const distanceKm = (p.distance_m / 1000).toFixed(1);
  const isFromGoogle = p.source === 'places_api';
  const requestedTime = requestedTimeIso ? new Date(requestedTimeIso).toLocaleString() : 'soon';

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{p.business_name}</h3>
            {isFromGoogle && (
              <span className="text-[9px] uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                via Google
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{distanceKm} km</span>
            {p.rating_avg > 0 ? (
              <span>★ {p.rating_avg.toFixed(1)}{p.rating_count > 0 ? ` (${p.rating_count})` : ''}</span>
            ) : <span className="italic">no rating</span>}
            {p.score !== undefined && <span className="text-emerald-600">score {p.score}</span>}
          </div>
          {p.reasoning && <p className="text-xs text-muted-foreground mt-1.5">{p.reasoning.en}</p>}
        </div>
        {isFromGoogle && (
          <button onClick={() => setContactOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
            Contact
          </button>
        )}
      </div>
      {isFromGoogle && (p.phone || p.google_maps_url) && (
        <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
          {p.phone && <a href={`tel:${p.phone}`} className="hover:underline">📞 {p.phone}</a>}
          {p.google_maps_url && <a href={p.google_maps_url} target="_blank" rel="noreferrer" className="hover:underline">View on Google ↗</a>}
        </div>
      )}
      {isFromGoogle && (
        <PlacesContactDialog
          open={contactOpen} onClose={() => setContactOpen(false)}
          provider={{ id: p.id, business_name: p.business_name, phone: p.phone, website: p.website, google_maps_url: p.google_maps_url }}
          serviceCategory={serviceSlug} requestedTime={requestedTime}
        />
      )}
      {!isFromGoogle && (
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          Tip: say &quot;book this&quot; or &quot;{p.business_name.split(' ')[0]} wale ko kal subah&quot; to confirm.
        </p>
      )}
    </div>
  );
}

function BookingConfirmedArtifact({ a }: { a: Extract<Artifact, { type: 'booking_confirmation' }> }) {
  const slot = new Date(a.slot_iso).toLocaleString();
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-3 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emerald-600">✓</span>
          <p className="font-medium">Invitation sent to {a.provider_name}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Slot: {slot} · Channel: <span className="font-medium uppercase">{a.invitation_channel}</span>
        </p>
        <div className="mt-2">
          <Link href={`/booking/${a.booking_id}`} className="text-xs font-medium hover:underline">
            Track this booking →
          </Link>
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
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-sm font-medium">{a.question}</p>
      <div className="flex flex-wrap gap-2">
        {a.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect?.(opt)}
            disabled={!onSelect}
            className="rounded-full border border-primary/40 bg-primary/5 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/15 disabled:opacity-50 transition"
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
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/10 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        That slot isn&apos;t available — here are the next free times for {a.provider_name}:
      </p>
      <div className="flex flex-wrap gap-2">
        {a.slots.map((slot) => (
          <button
            key={slot.iso}
            onClick={() => onSelect?.(`Book ${a.provider_name} at ${slot.label}`)}
            disabled={!onSelect}
            className="rounded-full border border-amber-400/40 bg-white dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 transition"
          >
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlacesContactSentArtifact({ a }: { a: Extract<Artifact, { type: 'places_contact_sent' }> }) {
  const slot = a.slot_iso ? new Date(a.slot_iso).toLocaleString() : null;
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/10 p-3 text-sm space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-purple-600 shrink-0">✉</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Request sent to {a.place_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {slot && <>Slot: {slot} · </>}Channel: <span className="font-medium uppercase">{a.channel}</span>
          </p>
        </div>
      </div>
      {a.booking_id && (
        <Link href={`/booking/${a.booking_id}`} className="block text-xs font-medium hover:underline">
          Track this request →
        </Link>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Preview the message</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-background border border-border rounded-md p-2">
{a.message_body}
        </pre>
      </details>
    </div>
  );
}
