import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProviderHeader from '@/components/layout/provider-header';
import ProviderSettingsForm from './settings-form';

export default async function ProviderSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/provider/settings');

  const { data: providers } = await supabase
    .from('providers')
    .select('id, business_name, phone, phone_verified, whatsapp_opt_in, sms_opt_in, categories, service_radius_km, weekly_hours, published, languages, certifications, tools_required')
    .eq('owner_user_id', user.id)
    .limit(1);
  if (!providers || providers.length === 0) redirect('/chat');

  const provider = providers[0];

  return (
    <>
      <ProviderHeader active="settings" businessName={provider.business_name} />
      <main className="container max-w-2xl py-6 sm:py-8">
        <h1 className="font-display text-xl sm:text-2xl font-700 tracking-tight text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-6">Edit your business profile, availability, and notifications.</p>
        <ProviderSettingsForm initial={provider} />
      </main>
    </>
  );
}
