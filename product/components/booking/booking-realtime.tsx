'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface BookingRow {
  id: string;
  status: string;
  slot_start: string;
  slot_end: string;
  service_category: string;
  location_text: string;
  invitation_channel: string | null;
  invitation_sent_at: string;
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
  if (booking.status === 'confirmed' || booking.status === 'reminded' || booking.status === 'in_progress') {
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
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        <Link href="/bookings" className="hover:underline">View all bookings</Link>
      </p>
    </main>
  );
}

function Confirmed({ booking, provider, slotDate }: { booking: BookingRow; provider: { business_name: string; phone: string | null; rating_avg: number } | null; slotDate: Date }) {
  return (
    <main className="container max-w-2xl py-10">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✓</span>
          <h1 className="text-lg font-semibold">Booking confirmed</h1>
        </div>
        <p className="text-sm">
          <span className="font-medium">{provider?.business_name}</span> will arrive on{' '}
          <span className="font-medium">{slotDate.toLocaleString()}</span>.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Service" value={booking.service_category.replace('_', ' ')} />
          <Info label="Slot" value={slotDate.toLocaleString()} />
          <Info label="Location" value={booking.location_text} />
          <Info label="Status" value={booking.status} />
        </div>
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
        <Link href={`/bookings?rate=${booking.id}`}
          className="mt-4 inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Rate now
        </Link>
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
