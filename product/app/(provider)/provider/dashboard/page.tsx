import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_sent_at, invitation_token, customer_name_snapshot, customer_phone_snapshot, notes, invitation_channel, service_checklist')
    .eq('provider_id', provider.id)
    .order('slot_start', { ascending: true });

  const all = bookings ?? [];
  const totalCompleted = all.filter((b) => b.status === 'completed').length;
  const totalActive = all.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status)).length;
  const totalPending = all.filter((b) => ['invitation_sent', 'query_sent'].includes(b.status)).length;
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
