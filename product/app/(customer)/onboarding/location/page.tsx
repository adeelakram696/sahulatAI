import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocationOnboardingForm from '@/components/location/onboarding-form';

export default async function OnboardingLocationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  return (
    <main className="container max-w-2xl py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Welcome — let&apos;s add your first location</h1>
        <p className="text-sm text-muted-foreground mt-2">
          We use this to find providers nearby. You can add more later.
        </p>
      </header>
      <LocationOnboardingForm userId={user.id} />
    </main>
  );
}
