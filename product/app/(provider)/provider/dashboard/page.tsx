import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import ProviderInbox from '@/components/provider/inbox';
import ProviderHeader from '@/components/layout/provider-header';
import {
  Star,
  Inbox,
  Activity,
  CheckCircle2,
  Phone,
  MessageCircle,
  TrendingUp,
  Pencil,
  Sparkles,
} from 'lucide-react';

export default async function ProviderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/provider/dashboard');

  const { data: providers } = await supabase
    .from('providers')
    .select('id, business_name, photo_url, phone, categories, google_rating, google_rating_count, portal_rating, portal_rating_count, response_time_minutes, whatsapp_opt_in, sms_opt_in, published')
    .eq('owner_user_id', user.id)
    .limit(1);

  if (!providers || providers.length === 0) {
    redirect('/provider/onboarding');
  }

  const provider = providers[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_sent_at, invitation_token, customer_name_snapshot, customer_phone_snapshot, notes, invitation_channel, service_checklist, evidence_photos, price_estimate, price_breakdown')
    .eq('provider_id', provider.id)
    .order('slot_start', { ascending: true });

  const all = bookings ?? [];
  const totalCompleted = all.filter((b) => b.status === 'completed').length;
  const totalActive = all.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status)).length;
  const totalPending = all.filter((b) => ['invitation_sent', 'query_sent'].includes(b.status)).length;
  const hasAnyActivity = totalCompleted > 0 || totalActive > 0 || totalPending > 0;

  let insights: {
    earnings: { week: number; month: number; currency: string };
    utilization: { pct: number; completed: number; total: number };
    best_slots: Array<{ hour: number; label: string; bookings: number }>;
    top_categories: Array<{ slug: string; count: number }>;
  } | null = null;
  try {
    const { data: insightRows } = await admin.rpc('get_provider_insights' as never, { p_provider_id: provider.id } as never).maybeSingle();
    void insightRows;
  } catch { /* ignore */ }
  {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAll = all.filter((b) => new Date(b.slot_start) >= monthStart);
    const monthCompleted = monthAll.filter((b) => b.status === 'completed');
    const weekCompleted = monthCompleted.filter((b) => new Date(b.slot_start) >= weekStart);
    const fallback = 1300;
    const earn = (list: typeof monthCompleted) => list.reduce((s, b) => s + ((b as { price_estimate?: { total?: number } }).price_estimate?.total ?? fallback), 0);
    const hourMap: Record<number, number> = {};
    for (const b of monthCompleted) { const h = new Date(b.slot_start).getHours(); hourMap[h] = (hourMap[h] ?? 0) + 1; }
    const bestSlots = Object.entries(hourMap).sort(([, a], [, b]) => b - a).slice(0, 3).map(([h, c]) => ({
      hour: +h, bookings: c,
      label: new Date(0, 0, 0, +h).toLocaleString('en-PK', { hour: 'numeric', hour12: true }),
    }));
    const catMap: Record<string, number> = {};
    for (const b of monthAll) { const c = b.service_category as string; catMap[c] = (catMap[c] ?? 0) + 1; }
    const topCats = Object.entries(catMap).sort(([, a], [, b]) => b - a).slice(0, 3).map(([slug, count]) => ({ slug, count }));
    const total = monthCompleted.length + totalActive;
    insights = {
      earnings: { week: Math.round(earn(weekCompleted)), month: Math.round(earn(monthCompleted)), currency: 'PKR' },
      utilization: { pct: total > 0 ? Math.round(monthCompleted.length / total * 100) : 0, completed: monthCompleted.length, total },
      best_slots: bestSlots,
      top_categories: topCats,
    };
  }

  const avatarUrl = provider.photo_url
    || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(provider.business_name)}`;
  const categories: string[] = provider.categories ?? [];

  return (
    <>
      <ProviderHeader active="dashboard" businessName={provider.business_name} />

      <main className="relative overflow-hidden container max-w-4xl py-5 sm:py-6 space-y-4 sm:space-y-5">
        {/* Ambient teal radial — same language as auth pages */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl -z-10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.08),transparent_70%)] blur-3xl -z-10"
        />

        {/* Profile hero */}
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/40 p-5 sm:p-6 shadow-sm">
          <span aria-hidden className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative flex items-start gap-3 sm:gap-4">
            <div className="size-16 sm:size-20 rounded-2xl overflow-hidden ring-2 ring-white dark:ring-card bg-muted shrink-0 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                Welcome back
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-foreground truncate">
                  {provider.business_name}
                </h1>
                {provider.published ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 font-semibold tracking-wide shrink-0">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] uppercase rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 font-semibold tracking-wide shrink-0">
                    Draft
                  </span>
                )}
              </div>

              {categories.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {categories.slice(0, 5).map((c) => (
                    <span
                      key={c}
                      className="text-[10.5px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold capitalize"
                    >
                      {c.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {categories.length > 5 && (
                    <span className="text-[10.5px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-semibold">
                      +{categories.length - 5}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {provider.phone && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Phone className="size-3.5 text-muted-foreground/70" strokeWidth={2.2} />
                    {provider.phone}
                  </span>
                )}
                {provider.whatsapp_opt_in && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <MessageCircle className="size-3.5" strokeWidth={2.2} />
                    WhatsApp
                  </span>
                )}
                {provider.sms_opt_in && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    SMS
                  </span>
                )}
              </div>
            </div>

            <Link
              href="/provider/settings"
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-card hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97] px-3 py-1.5 text-[12px] font-semibold text-foreground transition-all shadow-xs"
            >
              <Pencil className="size-3" strokeWidth={2.2} />
              Edit
            </Link>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Kpi
            label="SahuliatAI rating"
            value={
              provider.portal_rating_count > 0
                ? Number(provider.portal_rating).toFixed(1)
                : provider.google_rating > 0
                  ? Number(provider.google_rating).toFixed(1)
                  : '—'
            }
            sub={
              provider.portal_rating_count > 0
                ? `${provider.portal_rating_count} review${provider.portal_rating_count === 1 ? '' : 's'}`
                : provider.google_rating > 0
                  ? 'Google rating · no SahuliatAI reviews yet'
                  : 'no reviews yet'
            }
            Icon={Star}
            tint="amber"
          />
          <Kpi
            label="Pending"
            value={totalPending.toString()}
            sub="awaiting accept"
            Icon={Inbox}
            tint={totalPending > 0 ? 'rose' : 'slate'}
            emphasize={totalPending > 0}
          />
          <Kpi
            label="Active"
            value={totalActive.toString()}
            sub="in progress"
            Icon={Activity}
            tint="sky"
          />
          <Kpi
            label="Completed"
            value={totalCompleted.toString()}
            sub="all time"
            Icon={CheckCircle2}
            tint="emerald"
          />
        </section>

        {/* Empty state encouragement */}
        {!hasAnyActivity && (
          <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-4 sm:p-5">
            <span aria-hidden className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <span className="size-11 sm:size-12 shrink-0 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-primary-sm">
                <Sparkles className="size-5 text-white" strokeWidth={2.25} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[15px] sm:text-base tracking-tight text-foreground">
                  You&apos;re ready to receive bookings
                </p>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">
                  Your profile is live. Customers will be AI-matched to you based on services, area, and availability.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Insights */}
        {insights && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Earnings */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Earnings</p>
                <span className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                  <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
                </span>
              </div>
              <p className="font-display font-extrabold text-[26px] tracking-tight text-foreground leading-none">
                <span className="text-base text-muted-foreground font-semibold mr-1">PKR</span>
                {insights.earnings.month.toLocaleString()}
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-1.5">This month</p>
              <div className="mt-3 pt-3 border-t border-border/60 flex items-baseline justify-between">
                <span className="text-[11.5px] text-muted-foreground">This week</span>
                <span className="text-[13px] font-semibold text-foreground">PKR {insights.earnings.week.toLocaleString()}</span>
              </div>
            </div>

            {/* Utilization */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
                Utilization this month
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-extrabold text-[26px] tracking-tight text-foreground leading-none">
                  {insights.utilization.pct}
                </span>
                <span className="text-base font-bold text-muted-foreground">%</span>
              </div>
              <div className="mt-2.5 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gradient rounded-full transition-all duration-500"
                  style={{ width: `${insights.utilization.pct}%` }}
                />
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-2">
                {insights.utilization.completed} of {insights.utilization.total} jobs completed
              </p>
              {insights.top_categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {insights.top_categories.map((c) => (
                    <span key={c.slug} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 capitalize font-semibold">
                      {c.slug.replace(/_/g, ' ')} · {c.count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Peak demand */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
                Peak demand times
              </p>
              {insights.best_slots.length === 0 ? (
                <div className="flex items-center gap-2.5 py-2">
                  <span className="size-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60">
                    <Activity className="size-4" strokeWidth={2} />
                  </span>
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    Complete more jobs to see demand patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {insights.best_slots.map((s, idx) => (
                    <div key={s.hour} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground/60 w-3">{idx + 1}</span>
                      <span className="text-[12.5px] font-medium text-foreground flex-1 min-w-0 truncate">{s.label}</span>
                      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (s.bookings / (insights!.best_slots[0]?.bookings || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10.5px] text-muted-foreground shrink-0 w-7 text-right tabular-nums">{s.bookings}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Inbox */}
        <ProviderInbox provider={provider} initialBookings={all} />
      </main>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  Icon,
  tint,
  emphasize,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: 'amber' | 'rose' | 'sky' | 'emerald' | 'slate';
  emphasize?: boolean;
}) {
  const TINTS: Record<typeof tint, { bg: string; icon: string }> = {
    amber:   { bg: 'bg-amber-100 dark:bg-amber-950/40',     icon: 'text-amber-600 dark:text-amber-400' },
    rose:    { bg: 'bg-rose-100 dark:bg-rose-950/40',       icon: 'text-rose-600 dark:text-rose-400' },
    sky:     { bg: 'bg-sky-100 dark:bg-sky-950/40',         icon: 'text-sky-600 dark:text-sky-400' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', icon: 'text-emerald-600 dark:text-emerald-400' },
    slate:   { bg: 'bg-slate-100 dark:bg-slate-800',        icon: 'text-slate-500 dark:text-slate-400' },
  };
  const t = TINTS[tint];

  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-xs transition-colors ${
        emphasize
          ? 'border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-50 to-card dark:from-rose-950/20 dark:to-card'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className={`inline-flex size-7 items-center justify-center rounded-lg ${t.bg}`}>
          <Icon className={`size-3.5 ${t.icon}`} strokeWidth={2.2} />
        </span>
      </div>
      <p className="font-display font-extrabold text-2xl tracking-tight text-foreground leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
    </div>
  );
}
