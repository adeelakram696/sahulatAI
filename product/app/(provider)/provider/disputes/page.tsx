import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import ProviderHeader from '@/components/layout/provider-header';
import ProviderDisputeInbox from '@/components/provider/dispute-inbox';
import { Scale } from 'lucide-react';

export default async function ProviderDisputes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/provider/disputes');

  const { data: providerRow } = await admin
    .from('providers')
    .select('id, business_name')
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!providerRow) redirect('/provider/onboarding');

  const { data: disputes } = await admin
    .from('disputes')
    .select('id, kind, status, opened_at, resolved_at, statements, resolution, booking_id, bookings!inner(provider_id, customer_name_snapshot, service_category, slot_start, location_text)')
    .eq('bookings.provider_id', providerRow.id)
    .order('opened_at', { ascending: false });

  const list = disputes ?? [];
  const open = list.filter((d) => d.status === 'open' || d.status === 'under_review').length;
  const resolved = list.filter((d) => d.status === 'resolved').length;

  return (
    <>
      <ProviderHeader active="disputes" businessName={providerRow.business_name} />
      <main className="relative overflow-hidden container max-w-4xl py-5 sm:py-6 space-y-4 sm:space-y-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl -z-10"
        />

        <header className="relative">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
            Inbox
          </p>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground">
              Disputes
            </h1>
            {list.length > 0 && (
              <div className="flex items-center gap-1.5">
                {open > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[11px] font-semibold">
                    <span className="size-1.5 rounded-full bg-rose-500 animate-pulse-slow" />
                    {open} open
                  </span>
                )}
                {resolved > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
                    {resolved} resolved
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-prose">
            Customer complaints needing your response. The agent applies a deterministic policy once both sides submit statements.
          </p>
        </header>

        {list.length === 0 ? (
          <section className="relative overflow-hidden rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 via-card to-card dark:from-emerald-950/20 dark:via-card dark:to-card p-5 sm:p-6 shadow-xs">
            <span aria-hidden className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-2xl" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <span className="size-11 sm:size-12 shrink-0 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-sm">
                <Scale className="size-5 text-white" strokeWidth={2.25} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[15px] sm:text-base tracking-tight text-foreground">
                  No disputes — keep up the great service
                </p>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">
                  When a customer opens a complaint, you&apos;ll see it here with a deadline to respond.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <ProviderDisputeInbox initialDisputes={list.map((d) => ({
            ...d,
            bookings: Array.isArray(d.bookings) ? d.bookings[0] : d.bookings,
          })) as any} />
        )}
      </main>
    </>
  );
}
