import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProviderInbox from '@/components/provider/inbox';

export default async function ProviderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/provider/dashboard');

  const { data: providers } = await supabase
    .from('providers')
    .select('id, business_name')
    .eq('owner_user_id', user.id);
  if (!providers || providers.length === 0) redirect('/provider/onboarding');

  const provider = providers[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_sent_at, invitation_token, customer_name_snapshot, notes')
    .eq('provider_id', provider.id)
    .order('slot_start', { ascending: true });

  return <ProviderInbox provider={provider} initialBookings={bookings ?? []} />;
}
