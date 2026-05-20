import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import { ServiceIcon } from '@/components/ui/service-icon';
import { Plus, ChevronRight, Clock, Sparkles } from 'lucide-react';

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
  const hasData = all.length > 0;

  return (
    <>
      <AppHeader active="bookings" />
      <main className="relative overflow-hidden container max-w-3xl py-5 sm:py-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl -z-10"
        />

        {/* Header */}
        <div className="relative flex items-start justify-between mb-5 sm:mb-7 gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              Booking history
            </p>
            <h1 className="mt-1 font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground">
              My bookings
            </h1>
            {hasData ? (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {active.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                    <span className="size-1.5 rounded-full bg-primary animate-pulse-slow" />
                    {active.length} active
                  </span>
                )}
                {past.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-semibold">
                    {past.length} past
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">No bookings yet</p>
            )}
          </div>
          <Link
            href="/chat"
            className="btn-primary !py-2 !px-3 sm:!px-4 !text-xs gap-1.5 shrink-0"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">New request</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="space-y-6 sm:space-y-7">
            {active.length > 0 && (
              <div>
                <SectionLabel>Active &amp; upcoming</SectionLabel>
                <ul className="mt-3 space-y-2">
                  {active.map((b) => <BookingCard key={b.id} b={b} active />)}
                </ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <SectionLabel>Past</SectionLabel>
                <ul className="mt-3 space-y-2">
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
      {children}
    </h2>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/40 px-6 py-14 sm:py-16 text-center shadow-sm">
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full bg-primary/10 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 size-40 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative flex flex-col items-center">
        <div className="size-14 rounded-2xl bg-brand-gradient flex items-center justify-center mb-4 shadow-primary-sm">
          <Sparkles className="size-6 text-white" strokeWidth={2.25} />
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl tracking-tight text-foreground mb-1.5">
          No bookings yet
        </h3>
        <p className="text-[13px] sm:text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
          Describe your service need in the chat — our AI finds and books the right local pro for you.
        </p>
        <Link href="/chat" className="btn-primary !text-sm gap-2">
          Start a request
          <ChevronRight className="size-4" strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  );
}

function BookingCard({
  b,
  active,
}: {
  b: { id: string; status: string; slot_start: string; service_category: string; location_text: string; providers: unknown };
  active?: boolean;
}) {
  const prov = Array.isArray(b.providers) ? b.providers[0] : b.providers;
  const provName = (prov as { business_name?: string })?.business_name ?? 'Provider';

  return (
    <li>
      <Link
        href={`/booking/${b.id}`}
        className={`group relative flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 sm:p-4 transition-all active:scale-[0.99] ${
          active
            ? 'border-border hover:border-primary/40 hover:shadow-md'
            : 'border-border/70 hover:border-border'
        }`}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-brand-gradient"
          />
        )}

        <ServiceIcon slug={b.service_category} size="md" className={active ? 'ml-1.5' : ''} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[14px] text-foreground truncate">{provName}</p>
            <StatusPill status={b.status} />
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 capitalize truncate">
            {b.service_category.replace(/_/g, ' ')}
          </p>
          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span>
              {new Date(b.slot_start).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
        </div>

        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    query_sent:      { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',     label: 'Query sent' },
    invitation_sent: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',         label: 'Awaiting' },
    confirmed:       { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',                 label: 'Confirmed' },
    reminded:        { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',             label: 'Upcoming' },
    en_route:        { cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',     label: 'On the way' },
    arrived:         { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',     label: 'Arrived' },
    in_progress:     { cls: 'bg-primary/10 text-primary',                                                    label: 'In progress' },
    completed:       { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Done' },
    cancelled:       { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',            label: 'Cancelled' },
    rejected:        { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',             label: 'Rejected' },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-muted text-muted-foreground', label: status.replace(/_/g, ' ') };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}
