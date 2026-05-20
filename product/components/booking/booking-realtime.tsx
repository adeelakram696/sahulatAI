'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { RatingBadges } from '@/components/ui/rating-badges';
import RatingForm from '@/components/booking/rating-form';

export interface PriceBreakdown {
  currency: string;
  visit_fee: number;
  hours_estimate: number;
  hourly_rate: number;
  labor_cost: number;
  distance_km: number;
  distance_cost: number;
  base_subtotal: number;
  urgency_pct: number;
  complexity_pct: number;
  surge_pct: number;
  loyalty_pct: number;
  adjustments_total: number;
  total: number;
  explanation?: { en?: string; ur?: string };
}

interface BookingRow {
  id: string;
  status: string;
  slot_start: string;
  slot_end: string;
  service_category: string;
  location_text: string;
  invitation_channel: string | null;
  invitation_sent_at: string;
  complexity?: string | null;
  price_breakdown?: PriceBreakdown | null;
  en_route_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  service_checklist?: { key: string; label: string; done: boolean }[] | null;
  providers: { business_name: string; phone: string | null; google_rating: number; google_rating_count: number; portal_rating: number; portal_rating_count: number } | { business_name: string; phone: string | null; google_rating: number; google_rating_count: number; portal_rating: number; portal_rating_count: number }[] | null;
}

function getProvider(b: BookingRow): { business_name: string; phone: string | null; google_rating: number; google_rating_count: number; portal_rating: number; portal_rating_count: number } | null {
  if (!b.providers) return null;
  return Array.isArray(b.providers) ? (b.providers[0] ?? null) : b.providers;
}

export default function BookingRealtime({
  initial,
  existingRating,
}: {
  initial: BookingRow;
  existingRating?: { stars: number; comment: string | null } | null;
}) {
  const [booking, setBooking] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`booking_${booking.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${booking.id}` },
        (payload) => setBooking((b) => ({ ...b, ...(payload.new as Partial<BookingRow>) }))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [booking.id]);

  const prov = getProvider(booking);
  const slotDate = new Date(booking.slot_start);

  if (booking.status === 'query_sent') {
    return <QuerySent booking={booking} provider={prov} />;
  }
  if (booking.status === 'invitation_sent') {
    return <InvitationPending booking={booking} provider={prov} />;
  }
  if (['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(booking.status)) {
    return <Confirmed booking={booking} provider={prov} slotDate={slotDate} />;
  }
  if (booking.status === 'completed') {
    return <Completed booking={booking} provider={prov} existingRating={existingRating} />;
  }
  if (booking.status === 'rejected' || booking.status === 'cancelled') {
    return <Rejected booking={booking} provider={prov} status={booking.status} />;
  }
  return <p>Unknown status: {booking.status}</p>;
}

function QuerySent({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null }) {
  return (
    <main className="container max-w-2xl py-10 space-y-4">
      <div className="card-elevated p-6 border-l-4 border-l-violet-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-9 rounded-xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
            <span className="inline-block size-2.5 rounded-full bg-violet-500 animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-700 text-lg text-foreground">Query sent</h1>
            <p className="text-xs text-muted-foreground">Awaiting provider response</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          We&apos;ve messaged <span className="font-semibold text-foreground">{provider?.business_name}</span> via{' '}
          <span className="font-semibold uppercase">{booking.invitation_channel ?? 'mock'}</span>.
          They&apos;ll confirm once they tap the accept link.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Info label="Service" value={booking.service_category.replace(/_/g, ' ')} />
          <Info label="Slot" value={new Date(booking.slot_start).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Booking ID" value={booking.id.slice(0, 8)} />
        </div>
        {provider?.phone && (
          <div className="mt-5">
            <a href={`tel:${provider.phone}`} className="btn-ghost !text-xs !py-2 !px-3 gap-1.5">
              📞 Call {provider.phone}
            </a>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/bookings" className="hover:underline text-primary font-medium">← View all bookings</Link>
      </p>
    </main>
  );
}

function InvitationPending({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null }) {
  const sentMs = new Date(booking.invitation_sent_at).getTime();
  const expiresMs = sentMs + 15 * 60 * 1000;
  const [now, setNow] = useState(sentMs);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const remaining = Math.max(0, Math.floor((expiresMs - now) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = Math.round((remaining / (15 * 60)) * 100);

  return (
    <main className="container max-w-2xl py-10 space-y-4">
      <div className="card-elevated p-6 border-l-4 border-l-amber-400">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-9 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
            <span className="inline-block size-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-700 text-lg text-foreground">Invitation sent</h1>
            <p className="text-xs text-muted-foreground">Awaiting provider acceptance</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          We&apos;ve messaged <span className="font-semibold text-foreground">{provider?.business_name}</span> via{' '}
          <span className="font-semibold uppercase">{booking.invitation_channel}</span>.
        </p>

        {/* Countdown */}
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Expires in</span>
            <span className="text-sm font-bold font-mono text-amber-800 dark:text-amber-200">{mm}:{ss}</span>
          </div>
          <div className="h-1.5 bg-amber-200/60 dark:bg-amber-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {booking.invitation_channel === 'mock' && (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 p-3 text-xs mb-4">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-0.5">Demo mode</p>
            <p className="text-amber-700 dark:text-amber-300">WhatsApp/SMS not configured — the provider would receive a tokenized accept link.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Info label="Service" value={booking.service_category.replace(/_/g, ' ')} />
          <Info label="Slot" value={new Date(booking.slot_start).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Booking ID" value={booking.id.slice(0, 8)} />
        </div>
        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} compact />
        )}
      </div>
      <p className="text-center text-xs">
        <Link href="/bookings" className="hover:underline text-primary font-medium">← View all bookings</Link>
      </p>
    </main>
  );
}

function Confirmed({ booking, provider, slotDate }: { booking: BookingRow; provider: { business_name: string; phone: string | null; google_rating: number; google_rating_count: number; portal_rating: number; portal_rating_count: number } | null; slotDate: Date }) {
  const config = {
    confirmed:    { icon: '✓', color: 'emerald', headline: 'Booking confirmed',     sub: `${provider?.business_name} will arrive on ${slotDate.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}.` },
    reminded:     { icon: '🔔', color: 'sky',     headline: 'Service today',          sub: `${provider?.business_name} is scheduled for ${slotDate.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}.` },
    en_route:     { icon: '🚗', color: 'indigo',  headline: 'Provider on the way',    sub: `${provider?.business_name} is heading to your location.` },
    arrived:      { icon: '📍', color: 'violet',  headline: 'Provider has arrived',   sub: `${provider?.business_name} has reached your location.` },
    in_progress:  { icon: '⚙️', color: 'primary', headline: 'Service in progress',   sub: `${provider?.business_name} has started the service.` },
  }[booking.status] ?? { icon: '✓', color: 'emerald', headline: 'Booking confirmed', sub: '' };

  return (
    <main className="container max-w-2xl py-10 space-y-4">
      <div className="card-elevated p-6 border-l-4 border-l-emerald-500">
        <div className="flex items-start gap-3 mb-5">
          <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-lg shrink-0">
            {config.icon}
          </div>
          <div>
            <h1 className="font-display font-700 text-xl text-foreground">{config.headline}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{config.sub}</p>
          </div>
        </div>

        <ServiceTimeline booking={booking} />

        <div className="mt-5 grid grid-cols-2 gap-3 pt-5 border-t border-border">
          <Info label="Service" value={booking.service_category.replace(/_/g, ' ')} />
          <Info label="Slot" value={slotDate.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Status" value={booking.status.replace(/_/g, ' ')} />
        </div>

        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} />
        )}
        <SummaryCard booking={booking} provider={provider} />

        <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-2">
          <a href={buildGCalUrl(booking, provider)} target="_blank" rel="noreferrer"
            className="btn-ghost !text-xs !py-2 !px-3">
            📅 Google Calendar
          </a>
          <a href={buildICS(booking, provider)} download={`booking-${booking.id.slice(0, 8)}.ics`}
            className="btn-ghost !text-xs !py-2 !px-3">
            ⬇ Download .ics
          </a>
          <Link href={`/bookings/${booking.id}/dispute`}
            className="btn-ghost !text-xs !py-2 !px-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20">
            Report issue
          </Link>
        </div>
      </div>
      <p className="text-center text-xs">
        <Link href="/bookings" className="hover:underline text-primary font-medium">← View all bookings</Link>
      </p>
    </main>
  );
}

function Completed({
  booking,
  provider,
  existingRating,
}: {
  booking: BookingRow;
  provider: { business_name: string; phone: string | null } | null;
  existingRating?: { stars: number; comment: string | null } | null;
}) {
  return (
    <main className="container max-w-2xl py-10 space-y-4">
      <div className="card-elevated p-6 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-lg">
            🎉
          </div>
          <div>
            <h1 className="font-display font-700 text-xl text-foreground">Service completed</h1>
            <p className="text-sm text-muted-foreground">{provider?.business_name} marked this booking complete.</p>
          </div>
        </div>

        {booking.service_checklist && booking.service_checklist.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Service checklist</p>
            <ul className="space-y-2">
              {booking.service_checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2.5 text-sm">
                  <span className={`size-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    c.done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                  }`}>{c.done ? '✓' : '○'}</span>
                  <span className={c.done ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} compact />
        )}

        <div className="mt-4">
          <RatingForm bookingId={booking.id} existing={existingRating} />
        </div>

        <div className="mt-3">
          <Link href={`/bookings/${booking.id}/dispute`} className="btn-ghost !text-xs !py-2 !px-4">
            Report issue
          </Link>
        </div>
      </div>
      <p className="text-center text-xs">
        <Link href="/bookings" className="hover:underline text-primary font-medium">← View all bookings</Link>
      </p>
    </main>
  );
}

function Rejected({ booking: _booking, provider, status }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null; status: string }) {
  return (
    <main className="container max-w-2xl py-10 space-y-4">
      <div className="card-elevated p-6 border-l-4 border-l-rose-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center text-lg">
            {status === 'rejected' ? '✗' : '✕'}
          </div>
          <div>
            <h1 className="font-display font-700 text-xl text-foreground">
              {status === 'rejected' ? 'Provider unavailable' : 'Booking cancelled'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {provider?.business_name} didn&apos;t accept. Try another provider.
            </p>
          </div>
        </div>
        <Link href="/chat" className="btn-primary !text-sm">
          Search again
        </Link>
      </div>
      <p className="text-center text-xs">
        <Link href="/bookings" className="hover:underline text-primary font-medium">← View all bookings</Link>
      </p>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground capitalize">{value}</p>
    </div>
  );
}

function SummaryCard({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null; google_rating: number; google_rating_count: number; portal_rating: number; portal_rating_count: number } | null }) {
  return (
    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Booking summary</p>
      <dl className="grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Service</dt><dd className="font-medium capitalize">{booking.service_category.replace(/_/g, ' ')}</dd>
        <dt className="text-muted-foreground">Location</dt><dd className="font-medium">{booking.location_text}</dd>
        <dt className="text-muted-foreground">Time</dt><dd className="font-medium">{new Date(booking.slot_start).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
        <dt className="text-muted-foreground">Provider</dt><dd className="font-medium">{provider?.business_name}</dd>
        {provider && (provider.portal_rating_count > 0 || provider.google_rating > 0) && (
          <>
            <dt className="text-muted-foreground">Rating</dt>
            <dd>
              <RatingBadges
                portalRating={provider.portal_rating}
                portalCount={provider.portal_rating_count}
                googleRating={provider.google_rating}
              />
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Status</dt><dd className="font-medium text-emerald-600">Confirmed ✓</dd>
        <dt className="text-muted-foreground">Reminder</dt><dd className="font-medium">1 hour before</dd>
      </dl>
    </div>
  );
}

function ServiceTimeline({ booking }: { booking: BookingRow }) {
  const steps = [
    { key: 'confirmed', label: 'Booking confirmed',   match: ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress', 'completed'], at: booking.invitation_sent_at },
    { key: 'en_route',  label: 'On the way',          match: ['en_route', 'arrived', 'in_progress', 'completed'], at: booking.en_route_at },
    { key: 'arrived',   label: 'Arrived',             match: ['arrived', 'in_progress', 'completed'], at: booking.arrived_at },
    { key: 'in_progress', label: 'Service in progress', match: ['in_progress', 'completed'], at: null },
    { key: 'completed', label: 'Completed',           match: ['completed'], at: booking.completed_at },
  ];
  return (
    <ol className="my-5 space-y-0">
      {steps.map((s, idx) => {
        const reached = s.match.includes(booking.status);
        const isCurrent = (booking.status === s.key) || (booking.status === 'reminded' && s.key === 'confirmed');
        const isLast = idx === steps.length - 1;
        return (
          <li key={s.key} className="flex gap-3">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div className={`size-3.5 rounded-full border-2 shrink-0 mt-0.5 ${
                reached
                  ? isCurrent
                    ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)] animate-pulse'
                    : 'bg-emerald-500 border-emerald-500'
                  : 'bg-background border-border'
              }`} />
              {!isLast && <div className={`w-0.5 flex-1 my-1 ${reached ? 'bg-emerald-400/60' : 'bg-border'}`} />}
            </div>
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <p className={`text-sm ${reached ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
              {s.at && reached && (
                <p className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PriceBreakdownCard({ breakdown: raw, complexity, compact }: { breakdown: PriceBreakdown; complexity?: string | null; compact?: boolean }) {
  // Normalize old field names stored in DB before the naming fix
  const breakdown: PriceBreakdown = {
    ...raw,
    visit_fee:     raw.visit_fee     ?? (raw as unknown as Record<string, number>).base_visit_fee ?? 0,
    labor_cost:    raw.labor_cost    ?? (raw as unknown as Record<string, number>).hourly_cost     ?? 0,
    base_subtotal: raw.base_subtotal ?? (raw as unknown as Record<string, number>).subtotal        ?? 0,
    adjustments_total: raw.adjustments_total ?? (raw as unknown as Record<string, number>).adjustments_amount ?? 0,
  };
  const cur = breakdown.currency || 'PKR';
  const fmt = (n: number) => `${cur} ${Math.round(n ?? 0).toLocaleString('en-IN')}`;
  const adjRows = [
    breakdown.urgency_pct !== 0 && { label: 'Urgency', pct: breakdown.urgency_pct },
    breakdown.complexity_pct !== 0 && { label: 'Complexity', pct: breakdown.complexity_pct },
    breakdown.surge_pct !== 0 && { label: 'Surge', pct: breakdown.surge_pct },
    breakdown.loyalty_pct !== 0 && { label: 'Loyalty discount', pct: breakdown.loyalty_pct },
  ].filter(Boolean) as { label: string; pct: number }[];

  return (
    <div className={`${compact ? 'mt-4' : 'mt-5'} rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/15 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-300">Estimated price</p>
        {complexity && (
          <span className="text-[10px] uppercase tracking-wide bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-semibold">
            {complexity}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="font-display text-2xl font-700 text-sky-900 dark:text-sky-100">{fmt(breakdown.total)}</span>
        <span className="text-xs text-sky-600 dark:text-sky-400">final on completion</span>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Visit fee</dt><dd className="text-right font-medium">{fmt(breakdown.visit_fee)}</dd>
        <dt className="text-muted-foreground">Labor ({breakdown.hours_estimate}h × {fmt(breakdown.hourly_rate)})</dt>
        <dd className="text-right font-medium">{fmt(breakdown.labor_cost)}</dd>
        {breakdown.distance_cost > 0 && (
          <>
            <dt className="text-muted-foreground">Distance ({breakdown.distance_km.toFixed(1)} km)</dt>
            <dd className="text-right font-medium">{fmt(breakdown.distance_cost)}</dd>
          </>
        )}
        <dt className="text-muted-foreground border-t border-sky-200/60 dark:border-sky-900/40 pt-2 mt-1">Subtotal</dt>
        <dd className="text-right font-semibold border-t border-sky-200/60 dark:border-sky-900/40 pt-2 mt-1">{fmt(breakdown.base_subtotal)}</dd>
        {adjRows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className={`text-right font-medium ${r.pct > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {r.pct > 0 ? '+' : ''}{r.pct}%
            </dd>
          </div>
        ))}
      </dl>
      {breakdown.explanation?.en && !compact && (
        <p className="mt-3 text-xs text-muted-foreground italic border-t border-sky-200/40 pt-3">{breakdown.explanation.en}</p>
      )}
    </div>
  );
}

function buildGCalUrl(b: BookingRow, prov: { business_name: string } | null): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `${prov?.business_name ?? 'Service'} — SahuliatAI`);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  url.searchParams.set('dates', `${fmt(new Date(b.slot_start))}/${fmt(new Date(b.slot_end))}`);
  url.searchParams.set('location', b.location_text);
  return url.toString();
}

function buildICS(b: BookingRow, prov: { business_name: string } | null): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SahuliatAI//EN',
    'BEGIN:VEVENT', `UID:${b.id}@sahuliat.ai`,
    `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(new Date(b.slot_start))}`, `DTEND:${fmt(new Date(b.slot_end))}`,
    `SUMMARY:${prov?.business_name ?? 'Service'} — SahuliatAI`,
    `LOCATION:${b.location_text}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
