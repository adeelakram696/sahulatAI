import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocationOnboardingForm from '@/components/location/onboarding-form';
import { BrandIcon } from '@/components/ui/brand-mark';

export default async function OnboardingLocationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  return (
    <main className="relative min-h-screen overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.20),transparent_70%)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-32 size-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.10),transparent_70%)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl"
      />

      <div className="relative container max-w-xl py-10 sm:py-14">
        <header className="text-center mb-7">
          <div className="inline-flex shadow-primary-sm rounded-2xl mb-4">
            <BrandIcon size="lg" />
          </div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
            Onboarding · 1 of 1
          </p>
          <h1 className="mt-1.5 font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-foreground">
            Welcome — let&apos;s add your first location
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            We use this to find providers nearby. You can add more later.
          </p>
        </header>

        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 sm:p-6">
          <LocationOnboardingForm userId={user.id} />
        </div>
      </div>
    </main>
  );
}
