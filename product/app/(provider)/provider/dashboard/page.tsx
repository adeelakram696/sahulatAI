import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import ProviderInbox from '@/components/provider/inbox';
import ProviderHeader from '@/components/layout/provider-header';

export default async function ProviderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/provider/dashboard');

  const { data: providers } = await supabase
    .from('providers')
    .select('id, business_name, photo_url, phone, categories, rating_avg, rating_count, response_time_minutes, whatsapp_opt_in, sms_opt_in, published')
    .eq('owner_user_id', user.id)
    .limit(1);

  if (!providers || providers.length === 0) {
    // No provider row yet — they're probably mid-signup as a provider. Send
    // them to onboarding to create one. (Customers who land here by mistake
    // can navigate to /chat from the header.)
    redirect('/provider/onboarding');
  }

  const provider = providers[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_sent_at, invitation_token, customer_name_snapshot, customer_phone_snapshot, notes, invitation_channel, service_checklist, evidence_photos')
    .eq('provider_id', provider.id)
    .order('slot_start', { ascending: true });

  const all = bookings ?? [];
  const totalCompleted = all.filter((b) => b.status === 'completed').length;
  const totalActive = all.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status)).length;
  const totalPending = all.filter((b) => ['invitation_sent', 'query_sent'].includes(b.status)).length;

  // Insights: earnings + best slots
  let insights: {
    earnings: { week: number; month: number; currency: string };
    utilization: { pct: number; completed: number; total: number };
    best_slots: Array<{ hour: number; label: string; bookings: number }>;
    top_categories: Array<{ slug: string; count: number }>;
  } | null = null;
  try {
    const { data: insightRows } = await admin.rpc('get_provider_insights' as never, { p_provider_id: provider.id } as never).maybeSingle();
    void insightRows; // RPC may not exist; fall through to inline calc
  } catch { /* ignore */ }
  // Inline calculation (always available, no extra RPC needed)
  {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAll = all.filter((b) => new Date(b.slot_start) >= monthStart);
    const monthCompleted = monthAll.filter((b) => b.status === 'completed');
    const weekCompleted = monthCompleted.filter((b) => new Date(b.slot_start) >= weekStart);
    const fallback = 1300; // PKR default per job
    const earn = (list: typeof monthCompleted) => list.reduce((s, b) => s + ((b as {price_estimate?: {total?: number}}).price_estimate?.total ?? fallback), 0);
    const hourMap: Record<number, number> = {};
    for (const b of monthCompleted) { const h = new Date(b.slot_start).getHours(); hourMap[h] = (hourMap[h] ?? 0) + 1; }
    const bestSlots = Object.entries(hourMap).sort(([,a],[,b]) => b-a).slice(0,3).map(([h,c]) => ({
      hour: +h, bookings: c,
      label: new Date(0,0,0,+h).toLocaleString('en-PK', { hour: 'numeric', hour12: true }),
    }));
    const catMap: Record<string, number> = {};
    for (const b of monthAll) { const c = b.service_category as string; catMap[c] = (catMap[c]??0)+1; }
    const topCats = Object.entries(catMap).sort(([,a],[,b])=>b-a).slice(0,3).map(([slug,count])=>({ slug, count }));
    const total = monthCompleted.length + totalActive;
    insights = {
      earnings: { week: Math.round(earn(weekCompleted)), month: Math.round(earn(monthCompleted)), currency: 'PKR' },
      utilization: { pct: total > 0 ? Math.round(monthCompleted.length/total*100) : 0, completed: monthCompleted.length, total },
      best_slots: bestSlots,
      top_categories: topCats,
    };
  }
  const avatarUrl = provider.photo_url
    || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(provider.business_name)}`;

  return (
    <>
      <ProviderHeader active="dashboard" businessName={provider.business_name} />
      <main className="container max-w-4xl py-6 space-y-6">
        {/* Profile card */}
        <section className="card-elevated p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="size-14 sm:size-16 rounded-2xl overflow-hidden border border-border bg-muted shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display font-700 text-lg sm:text-xl tracking-tight text-foreground truncate">{provider.business_name}</h1>
                    {provider.published ? (
                      <span className="text-[10px] uppercase rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 px-2 py-0.5 font-semibold tracking-wide shrink-0">Live</span>
                    ) : (
                      <span className="text-[10px] uppercase rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 font-semibold tracking-wide shrink-0">Draft</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize line-clamp-1">
                    {(provider.categories ?? []).map((c: string) => c.replace(/_/g, ' ')).join(' · ') || 'No categories yet'}
                  </p>
                </div>
                <Link href="/provider/settings" className="btn-ghost !text-xs !py-1.5 !px-3 shrink-0">
                  Edit
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground mt-2">
                {provider.phone && <span>📞 {provider.phone}</span>}
                {provider.whatsapp_opt_in && <span className="text-emerald-600 font-medium">WhatsApp ✓</span>}
                {provider.sms_opt_in && <span className="text-emerald-600 font-medium">SMS ✓</span>}
              </div>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Rating" value={provider.rating_avg > 0 ? `★ ${Number(provider.rating_avg).toFixed(1)}` : '—'} sub={`${provider.rating_count ?? 0} reviews`} />
          <Kpi label="Pending" value={totalPending.toString()} sub="awaiting your accept" highlight={totalPending > 0} />
          <Kpi label="Active" value={totalActive.toString()} sub="confirmed / in-progress" />
          <Kpi label="Completed" value={totalCompleted.toString()} sub="all time" />
        </section>

        {/* Insights */}
        {insights && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Earnings */}
            <div className="card-elevated p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Earnings</p>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">This week</span>
                  <span className="text-sm font-bold text-foreground">PKR {insights.earnings.week.toLocaleString()}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">This month</span>
                  <span className="text-base font-bold text-primary">PKR {insights.earnings.month.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Utilization */}
            <div className="card-elevated p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Utilization this month</p>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand-gradient rounded-full transition-all duration-500" style={{ width: `${insights.utilization.pct}%` }} />
                </div>
                <span className="text-sm font-bold text-foreground w-8 text-right">{insights.utilization.pct}%</span>
              </div>
              <p className="text-xs text-muted-foreground">{insights.utilization.completed} of {insights.utilization.total} jobs completed</p>
              {insights.top_categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {insights.top_categories.map((c) => (
                    <span key={c.slug} className="text-[10px] bg-primary/8 text-primary rounded-full px-2 py-0.5 capitalize font-medium">
                      {c.slug.replace(/_/g, ' ')} ({c.count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Best Slots */}
            <div className="card-elevated p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Peak demand times</p>
              {insights.best_slots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Complete more jobs to see demand patterns.</p>
              ) : (
                <div className="space-y-2.5">
                  {insights.best_slots.map((s, idx) => (
                    <div key={s.hour} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground w-4">{idx + 1}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (s.bookings / (insights!.best_slots[0]?.bookings || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{s.bookings}×</span>
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

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/15' : 'border-border bg-card'} shadow-xs`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-2xl font-display font-700 mt-1 tracking-tight ${highlight ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
