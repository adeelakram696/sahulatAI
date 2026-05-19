import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import ProviderHeader from '@/components/layout/provider-header';
import ProviderDisputeInbox from '@/components/provider/dispute-inbox';

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

  return (
    <>
      <ProviderHeader active="disputes" businessName={providerRow.business_name} />
      <main className="container max-w-4xl py-6 space-y-4">
        <header>
          <h1 className="text-xl font-bold">Disputes</h1>
          <p className="text-xs text-muted-foreground">Customer complaints that need your response.</p>
        </header>
        <ProviderDisputeInbox initialDisputes={(disputes ?? []).map((d) => ({
          ...d,
          bookings: Array.isArray(d.bookings) ? d.bookings[0] : d.bookings,
        })) as any} />
      </main>
    </>
  );
}
