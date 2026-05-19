import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import { Calendar, Plus, ChevronRight, Clock } from 'lucide-react';

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, slot_start, service_category, location_text, providers(business_name)')
    .eq('customer_user_id', user.id)
    .order('slot_start', { ascending: false });

  const all = bookings ?? [];
  const active = all.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress', 'invitation_sent', 'query_sent'].includes(b.status));
  const past = all.filter((b) => ['completed', 'cancelled', 'rejected'].includes(b.status));

  return (
    <>
      <AppHeader active="bookings" />
      <main className="container max-w-3xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-700 tracking-tight text-foreground">My Bookings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {all.length === 0 ? 'No bookings yet' : `${all.length} booking${all.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <Link href="/chat" className="btn-primary !py-2 !px-4 !text-xs gap-1.5">
            <Plus className="size-3.5" />
            New request
          </Link>
        </div>

        {all.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Active & Upcoming</p>
                <ul className="space-y-2">
                  {active.map((b) => <BookingCard key={b.id} b={b} />)}
                </ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Past</p>
                <ul className="space-y-2">
                  {past.map((b) => <BookingCard key={b.id} b={b} />)}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="card-elevated flex flex-col items-center py-16 px-6 text-center">
      <div className="size-14 rounded-2xl bg-brand-gradient-subtle flex items-center justify-center mb-4">
        <Calendar className="size-7 text-primary" />
      </div>
      <h3 className="font-display font-700 text-base text-foreground mb-1">No bookings yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Describe your service need in the chat and we&apos;ll find and book the right provider near you.
      </p>
      <Link href="/chat" className="btn-primary !text-sm gap-2">
        Start a request
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function BookingCard({ b }: { b: { id: string; status: string; slot_start: string; service_category: string; location_text: string; providers: unknown } }) {
  const prov = Array.isArray(b.providers) ? b.providers[0] : b.providers;
  const provName = (prov as { business_name?: string })?.business_name ?? 'Provider';
  const isActive = ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status);

  return (
    <li>
      <Link
        href={`/booking/${b.id}`}
        className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all"
      >
        {/* Category icon */}
        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
          {categoryEmoji(b.service_category)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{provName}</p>
            <StatusPill status={b.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {b.service_category.replace(/_/g, ' ')}
          </p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span>{new Date(b.slot_start).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>

        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    query_sent:      { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',   label: 'Query sent' },
    invitation_sent: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',       label: 'Awaiting' },
    confirmed:       { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',               label: 'Confirmed' },
    reminded:        { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',           label: 'Upcoming' },
    en_route:        { cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',   label: 'On the way' },
    arrived:         { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',   label: 'Arrived' },
    in_progress:     { cls: 'bg-primary/10 text-primary',                                                  label: 'In progress' },
    completed:       { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Done' },
    cancelled:       { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',          label: 'Cancelled' },
    rejected:        { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',           label: 'Rejected' },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-muted text-muted-foreground', label: status.replace(/_/g, ' ') };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

function categoryEmoji(slug: string): string {
  const map: Record<string, string> = {
    ac_repair: '❄️', plumber: '🔧', electrician: '⚡', tutor: '📚',
    beautician: '💄', carpenter: '🪚', car_wash: '🚗', car_mechanic: '🔩',
    mobile_repair: '📱', house_cleaning: '🧹', cook: '👨‍🍳', painter: '🎨',
    mason: '🧱', appliance_repair: '🔌', gardening: '🌿', pest_control: '🐛',
  };
  return map[slug] ?? '🛠️';
}
