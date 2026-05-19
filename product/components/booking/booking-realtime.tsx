'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
  providers: { business_name: string; phone: string | null; rating_avg: number } | { business_name: string; phone: string | null; rating_avg: number }[] | null;
}

function getProvider(b: BookingRow): { business_name: string; phone: string | null; rating_avg: number } | null {
  if (!b.providers) return null;
  return Array.isArray(b.providers) ? (b.providers[0] ?? null) : b.providers;
}

export default function BookingRealtime({ initial }: { initial: BookingRow }) {
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
    return <Completed booking={booking} provider={prov} />;
  }
  if (booking.status === 'rejected' || booking.status === 'cancelled') {
    return <Rejected booking={booking} provider={prov} status={booking.status} />;
  }
  return <p>Unknown status: {booking.status}</p>;
}

function QuerySent({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null }) {
  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block size-2 rounded-full bg-purple-500 animate-pulse" />
          <h1 className="text-lg font-semibold">Query sent</h1>
        </div>
        <p className="text-sm">
          We&apos;ve messaged <span className="font-medium">{provider?.business_name}</span> on Google via{' '}
          <span className="font-medium uppercase">{booking.invitation_channel ?? 'mock'}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          They aren&apos;t on SahuliatAI yet — once they tap the accept link, this booking will switch to <em>confirmed</em>.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Service" value={booking.service_category.replace('_', ' ')} />
          <Info label="Slot" value={new Date(booking.slot_start).toLocaleString()} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Booking ID" value={booking.id.slice(0, 8)} />
        </div>

        {provider?.phone && (
          <div className="mt-6 flex gap-3">
            <a href={`tel:${provider.phone}`}
              className="rounded-md border border-border px-3 py-2 text-sm">
              📞 Call {provider.phone}
            </a>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        <Link href="/bookings" className="hover:underline">View all bookings</Link>
      </p>
    </main>
  );
}

function InvitationPending({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null }) {
  const sentMs = new Date(booking.invitation_sent_at).getTime();
  const expiresMs = sentMs + 15 * 60 * 1000;
  // Initialize to sentMs so server-rendered HTML matches the first client render
  // (avoids hydration mismatch). useEffect kicks in on mount and starts ticking.
  const [now, setNow] = useState(sentMs);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const remaining = Math.max(0, Math.floor((expiresMs - now) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" />
          <h1 className="text-lg font-semibold">Invitation sent</h1>
        </div>
        <p className="text-sm">
          We&apos;ve messaged <span className="font-medium">{provider?.business_name}</span> via{' '}
          <span className="font-medium uppercase">{booking.invitation_channel}</span>.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Awaiting acceptance · expires in {mm}:{ss}
        </p>
        {booking.invitation_channel === 'mock' && (
          <div className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
            <p className="font-medium mb-1">Demo Mode</p>
            <p>WhatsApp / SMS aren&apos;t configured. The provider would receive a tokenized link to accept this booking.</p>
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Service" value={booking.service_category.replace('_', ' ')} />
          <Info label="Slot" value={new Date(booking.slot_start).toLocaleString()} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Booking ID" value={booking.id.slice(0, 8)} />
        </div>
        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} compact />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        <Link href="/bookings" className="hover:underline">View all bookings</Link>
      </p>
    </main>
  );
}

function Confirmed({ booking, provider, slotDate }: { booking: BookingRow; provider: { business_name: string; phone: string | null; rating_avg: number } | null; slotDate: Date }) {
  const headline = {
    confirmed: 'Booking confirmed',
    reminded: 'Service today',
    en_route: 'Provider on the way',
    arrived: 'Provider has arrived',
    in_progress: 'Service in progress',
  }[booking.status] ?? 'Booking confirmed';

  const subhead = {
    confirmed: `${provider?.business_name} will arrive on ${slotDate.toLocaleString()}.`,
    reminded: `${provider?.business_name} is scheduled for ${slotDate.toLocaleString()}.`,
    en_route: `${provider?.business_name} is on the way. Track updates here.`,
    arrived: `${provider?.business_name} has reached your location.`,
    in_progress: `${provider?.business_name} has started the service.`,
  }[booking.status] ?? `${provider?.business_name} will arrive on ${slotDate.toLocaleString()}.`;

  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✓</span>
          <h1 className="text-lg font-semibold">{headline}</h1>
        </div>
        <p className="text-sm">{subhead}</p>
        <ServiceTimeline booking={booking} />
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Service" value={booking.service_category.replace('_', ' ')} />
          <Info label="Slot" value={slotDate.toLocaleString()} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Status" value={booking.status} />
        </div>
        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} />
        )}
        <SummaryCard booking={booking} provider={provider} />
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={buildGCalUrl(booking, provider)} target="_blank" rel="noreferrer"
            className="rounded-md border border-border px-3 py-2 text-sm">
            Add to Google Calendar
          </a>
          <a href={buildICS(booking, provider)} download={`booking-${booking.id.slice(0, 8)}.ics`}
            className="rounded-md border border-border px-3 py-2 text-sm">
            Download .ics
          </a>
          <Link href={`/bookings/${booking.id}/dispute`}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Report an issue
          </Link>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        <Link href="/bookings" className="hover:underline">View all bookings</Link>
      </p>
    </main>
  );
}

function Completed({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null }) {
  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold mb-2">Service completed</h1>
        <p className="text-sm">{provider?.business_name} marked this booking complete. Please rate your experience.</p>
        {booking.service_checklist && booking.service_checklist.length > 0 && (
          <div className="mt-4 rounded-md border border-border bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Service checklist</p>
            <ul className="space-y-1 text-sm">
              {booking.service_checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  <span className={c.done ? 'text-emerald-600' : 'text-muted-foreground'}>{c.done ? '✓' : '○'}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {booking.price_breakdown && (
          <PriceBreakdownCard breakdown={booking.price_breakdown} complexity={booking.complexity} compact />
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link href={`/bookings?rate=${booking.id}`}
            className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            Rate now
          </Link>
          <Link href={`/bookings/${booking.id}/dispute`}
            className="inline-block rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Report an issue
          </Link>
        </div>
      </div>
    </main>
  );
}

function Rejected({ booking, provider, status }: { booking: BookingRow; provider: { business_name: string; phone: string | null } | null; status: string }) {
  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/10 p-6">
        <h1 className="text-lg font-semibold mb-2">
          {status === 'rejected' ? 'Provider unavailable' : 'Booking cancelled'}
        </h1>
        <p className="text-sm">
          {provider?.business_name} didn&apos;t accept this invitation. Try another provider.
        </p>
        <Link href="/chat" className="mt-4 inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Search again
        </Link>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function SummaryCard({ booking, provider }: { booking: BookingRow; provider: { business_name: string; phone: string | null; rating_avg: number } | null }) {
  return (
    <div className="mt-6 rounded-md border border-border bg-background p-4">
      <p className="text-xs font-semibold mb-2 text-muted-foreground">SUMMARY</p>
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Service Request</dt><dd>{booking.service_category.replace('_', ' ')}</dd>
        <dt className="text-muted-foreground">Location</dt><dd>{booking.location_text}</dd>
        <dt className="text-muted-foreground">Time</dt><dd>{new Date(booking.slot_start).toLocaleString()}</dd>
        <dt className="text-muted-foreground">Provider</dt><dd>{provider?.business_name}</dd>
        <dt className="text-muted-foreground">Booking</dt><dd>Slot booked · confirmation sent ✓</dd>
        <dt className="text-muted-foreground">Follow-up</dt><dd>Reminder 1 h before</dd>
      </dl>
    </div>
  );
}

function ServiceTimeline({ booking }: { booking: BookingRow }) {
  const steps = [
    { key: 'confirmed', label: 'Booking confirmed', match: ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress', 'completed'], at: booking.invitation_sent_at },
    { key: 'en_route', label: 'On the way', match: ['en_route', 'arrived', 'in_progress', 'completed'], at: booking.en_route_at },
    { key: 'arrived', label: 'Arrived', match: ['arrived', 'in_progress', 'completed'], at: booking.arrived_at },
    { key: 'in_progress', label: 'Service in progress', match: ['in_progress', 'completed'], at: null },
    { key: 'completed', label: 'Completed', match: ['completed'], at: booking.completed_at },
  ];
  return (
    <ol className="mt-5 space-y-3 border-l border-emerald-300/40 pl-4">
      {steps.map((s) => {
        const reached = s.match.includes(booking.status);
        const isCurrent = (booking.status === s.key) || (booking.status === 'reminded' && s.key === 'confirmed');
        return (
          <li key={s.key} className="relative">
            <span className={`absolute -left-[20px] top-1 size-3 rounded-full border-2 ${
              reached ? (isCurrent ? 'bg-emerald-500 border-emerald-500 animate-pulse' : 'bg-emerald-500 border-emerald-500') : 'bg-background border-muted-foreground/30'
            }`} />
            <p className={`text-sm ${reached ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</p>
            {s.at && reached && <p className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleTimeString()}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function PriceBreakdownCard({ breakdown, complexity, compact }: { breakdown: PriceBreakdown; complexity?: string | null; compact?: boolean }) {
  const cur = breakdown.currency || 'PKR';
  const fmt = (n: number) => `${cur} ${Math.round(n).toLocaleString('en-IN')}`;
  const adjRows = [
    breakdown.urgency_pct !== 0 && { label: 'Urgency', pct: breakdown.urgency_pct },
    breakdown.complexity_pct !== 0 && { label: 'Complexity', pct: breakdown.complexity_pct },
    breakdown.surge_pct !== 0 && { label: 'Surge', pct: breakdown.surge_pct },
    breakdown.loyalty_pct !== 0 && { label: 'Loyalty discount', pct: breakdown.loyalty_pct },
  ].filter(Boolean) as { label: string; pct: number }[];

  return (
    <div className={`${compact ? 'mt-4' : 'mt-6'} rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/10 dark:border-blue-900 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">ESTIMATED PRICE</p>
        {complexity && (
          <span className="text-[10px] uppercase tracking-wide bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
            {complexity}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xl font-semibold">{fmt(breakdown.total)}</span>
        <span className="text-xs text-muted-foreground">final on completion</span>
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Visit fee</dt><dd className="text-right">{fmt(breakdown.visit_fee)}</dd>
        <dt className="text-muted-foreground">Labor ({breakdown.hours_estimate}h × {fmt(breakdown.hourly_rate)})</dt><dd className="text-right">{fmt(breakdown.labor_cost)}</dd>
        {breakdown.distance_cost > 0 && (
          <>
            <dt className="text-muted-foreground">Distance ({breakdown.distance_km.toFixed(1)} km)</dt>
            <dd className="text-right">{fmt(breakdown.distance_cost)}</dd>
          </>
        )}
        <dt className="text-muted-foreground border-t border-blue-200/50 dark:border-blue-900/50 pt-1 mt-1">Base subtotal</dt>
        <dd className="text-right border-t border-blue-200/50 dark:border-blue-900/50 pt-1 mt-1">{fmt(breakdown.base_subtotal)}</dd>
        {adjRows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className={`text-right ${r.pct > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {r.pct > 0 ? '+' : ''}{r.pct}%
            </dd>
          </div>
        ))}
      </dl>
      {breakdown.explanation?.en && !compact && (
        <p className="mt-3 text-xs text-muted-foreground italic">{breakdown.explanation.en}</p>
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
