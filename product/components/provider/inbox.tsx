'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Booking {
  id: string; status: string; slot_start: string; slot_end: string;
  service_category: string; location_text: string; invitation_sent_at: string;
  invitation_token: string; customer_name_snapshot: string | null;
  notes?: string | null;
}

export default function ProviderInbox({
  provider, initialBookings,
}: { provider: { id: string; business_name: string }; initialBookings: Booking[] }) {
  const [bookings, setBookings] = useState(initialBookings);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`provider_dashboard_${provider.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `provider_id=eq.${provider.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBookings((prev) => [payload.new as Booking, ...prev]);
            toast.message('New booking invitation', { description: 'Check your inbox.' });
          } else if (payload.eventType === 'UPDATE') {
            setBookings((prev) => prev.map((b) => b.id === (payload.new as Booking).id ? { ...b, ...(payload.new as Booking) } : b));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const invitations = bookings.filter((b) => b.status === 'invitation_sent' || b.status === 'query_sent');
  const upcoming = bookings.filter((b) => ['confirmed', 'reminded', 'in_progress'].includes(b.status));
  const past = bookings.filter((b) => ['completed', 'cancelled', 'rejected'].includes(b.status));

  return (
    <main className="container max-w-3xl py-8">
      <header className="mb-6">
        <p className="text-xs text-muted-foreground">Provider</p>
        <h1 className="text-2xl font-bold">{provider.business_name}</h1>
      </header>

      <Section title={`Invitations (${invitations.length})`} subtitle="Tap Accept to confirm">
        {invitations.length === 0 ? <Empty text="No pending invitations." />
          : invitations.map((b) => <InvitationCard key={b.id} b={b} />)}
      </Section>

      <Section title={`Upcoming (${upcoming.length})`}>
        {upcoming.length === 0 ? <Empty text="Nothing upcoming." />
          : upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
      </Section>

      <Section title={`Past (${past.length})`}>
        {past.length === 0 ? <Empty text="No past bookings yet." />
          : past.slice(0, 10).map((b) => <BookingRow key={b.id} b={b} />)}
      </Section>
    </main>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic">{text}</p>;
}

function InvitationCard({ b }: { b: Booking }) {
  const isQuerySent = b.status === 'query_sent';
  const [pending, setPending] = useState<null | 'accept' | 'reject'>(null);
  const remaining = useCountdown(b.invitation_sent_at);

  async function handle(action: 'accept' | 'reject') {
    setPending(action);
    const url = action === 'accept' ? '/api/provider/accept' : '/api/provider/reject';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: b.invitation_token }),
    });
    setPending(null);
    if (!res.ok) toast.error(`${action} failed`);
  }

  return (
    <div className={`rounded-md border p-3 text-sm ${isQuerySent ? 'border-purple-200 bg-purple-50 dark:bg-purple-950/10' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/10'}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">
              {b.customer_name_snapshot || 'Customer'} · {b.service_category.replace('_', ' ')}
            </p>
            {isQuerySent && (
              <span className="text-[9px] uppercase tracking-wide rounded-full border border-purple-300 px-1.5 py-0.5 text-purple-700">
                From Google search
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(b.slot_start).toLocaleString()} · {b.location_text}
          </p>
          {b.notes && String(b.notes).trim().length > 0 && (
            <p className="text-xs mt-1.5 rounded bg-muted/60 px-2 py-1 italic">
              💬 {b.notes}
            </p>
          )}
        </div>
        <span className="text-[10px] font-medium text-amber-700">{remaining}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => handle('reject')} disabled={pending !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs">
          {pending === 'reject' ? 'Working…' : 'Reject'}
        </button>
        <button onClick={() => handle('accept')} disabled={pending !== null}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium">
          {pending === 'accept' ? 'Working…' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

function BookingRow({ b }: { b: Booking }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <p className="font-medium">{b.customer_name_snapshot || 'Customer'}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {b.service_category.replace('_', ' ')} · {new Date(b.slot_start).toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {b.location_text} · <span className="font-medium">{b.status.replace('_', ' ')}</span>
      </p>
    </div>
  );
}

function useCountdown(sentAt: string): string {
  const sentMs = new Date(sentAt).getTime();
  // Initialize to sentMs so SSR and client hydration agree on the first frame.
  const [now, setNow] = useState(sentMs);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const expiresAt = sentMs + 15 * 60 * 1000;
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  if (remaining === 0) return 'expired';
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
