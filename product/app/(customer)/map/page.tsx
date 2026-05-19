import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import AppHeader from '@/components/layout/app-header';
import ProviderMap from '@/components/map/provider-map';
import { env } from '@/lib/env';

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/map');

  const { data: locList } = await supabase
    .from('user_locations')
    .select('id')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (!locList || locList.length === 0) redirect('/onboarding/location');

  const { data: locRows } = await admin.rpc('get_user_location_geo', { p_id: locList[0].id });
  const primary = (locRows ?? [])[0];
  if (!primary) redirect('/onboarding/location');

  const browserKey = env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';

  return (
    <>
      <AppHeader active="map" />
      <main className="container max-w-5xl py-4">
        <ProviderMap
          initialCenter={{ lat: primary.lat as number, lng: primary.lng as number }}
          apiKey={browserKey}
        />
      </main>
    </>
  );
}
