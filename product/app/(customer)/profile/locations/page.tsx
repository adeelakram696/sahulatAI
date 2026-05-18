import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';

export default async function LocationsManagerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  const { data: locations } = await supabase
    .from('user_locations')
    .select('id, label, address_text, city, town_or_area')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <>
      <AppHeader active="locations" />
      <main className="container max-w-2xl py-10">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your locations</h1>
          <Link href="/onboarding/location" className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5">
            + Add
          </Link>
        </header>
        <ul className="space-y-2">
          {(locations ?? []).map((l) => (
            <li key={l.id} className="rounded-md border border-border bg-card p-4 text-sm">
              <p className="font-medium">{l.label}</p>
              <p className="text-xs text-muted-foreground">
                {l.town_or_area || l.city || ''} · {l.address_text}
              </p>
            </li>
          ))}
          {(!locations || locations.length === 0) && (
            <p className="text-sm text-muted-foreground">No locations yet.</p>
          )}
        </ul>
      </main>
    </>
  );
}
