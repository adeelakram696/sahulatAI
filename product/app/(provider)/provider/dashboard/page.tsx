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
        {/* Hero / profile summary */}
        <section className="rounded-lg border border-border bg-card p-5 flex items-start gap-4">
          <div className="size-16 rounded-full overflow-hidden border border-border bg-muted shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{provider.business_name}</h1>
              {provider.published ? (
                <span className="text-[10px] uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 px-1.5 py-0.5 font-medium">live</span>
              ) : (
                <span className="text-[10px] uppercase rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-1.5 py-0.5 font-medium">unpublished</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(provider.categories ?? []).map((c: string) => c.replace('_', ' ')).join(' · ') || 'No categories yet'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
              {provider.phone && <span>📞 {provider.phone}</span>}
              {provider.whatsapp_opt_in && <span className="text-emerald-700">WhatsApp on</span>}
              {provider.sms_opt_in && <span className="text-emerald-700">SMS on</span>}
            </div>
          </div>
          <Link href="/provider/settings"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
            Edit profile
          </Link>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Rating" value={provider.rating_avg > 0 ? `★ ${Number(provider.rating_avg).toFixed(1)}` : '—'} sub={`${provider.rating_count ?? 0} reviews`} />
          <Kpi label="Pending" value={totalPending.toString()} sub="awaiting your accept" highlight={totalPending > 0} />
          <Kpi label="Active" value={totalActive.toString()} sub="confirmed / in-progress" />
          <Kpi label="Completed" value={totalCompleted.toString()} sub="total served" />
        </section>

        {/* Insights */}
        {insights && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Earnings */}
            <div className="rounded-lg border border-border bg-card p-4 md:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Earnings</p>
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">This week</span>
                  <span className="text-sm font-bold">PKR {insights.earnings.week.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">This month</span>
                  <span className="text-sm font-bold">PKR {insights.earnings.month.toLocaleString()}</span>
                </div>
              </div>
            </div>
            {/* Utilization */}
            <div className="rounded-lg border border-border bg-card p-4 md:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Utilization this month</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${insights.utilization.pct}%` }} />
                </div>
                <span className="text-sm font-bold">{insights.utilization.pct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{insights.utilization.completed} of {insights.utilization.total} jobs completed</p>
              {insights.top_categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {insights.top_categories.map((c) => (
                    <span key={c.slug} className="text-[10px] bg-muted rounded px-1.5 py-0.5 capitalize">
                      {c.slug.replace('_', ' ')} ({c.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* Best Slots */}
            <div className="rounded-lg border border-border bg-card p-4 md:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recommended time slots</p>
              {insights.best_slots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Complete more jobs to see demand patterns.</p>
              ) : (
                <div className="space-y-1.5">
                  {insights.best_slots.map((s) => (
                    <div key={s.hour} className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, s.bookings * 20)}%` }} />
                      </div>
                      <span className="text-xs">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{s.bookings} bookings</span>
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
    <div className={`rounded-lg border ${highlight ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/10' : 'border-border bg-card'} p-3`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
