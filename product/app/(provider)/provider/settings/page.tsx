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
      <main className="relative overflow-hidden container max-w-2xl py-5 sm:py-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl -z-10"
        />

        <header className="relative mb-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
            Account
          </p>
          <h1 className="mt-1 font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Edit your business profile, availability, and notifications.
          </p>
        </header>

        <ProviderSettingsForm initial={provider} />
      </main>
    </>
  );
}
