import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader />
      <main className="container max-w-3xl py-16 md:py-24">

      <header className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {t('hero')}
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          {t('subtitle')}
        </p>

        <div className="pt-6">
          <Link
            href={user ? '/chat' : '/auth/signup'}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover:opacity-90"
          >
            {user ? 'Open chat →' : 'Get started →'}
          </Link>
        </div>

        <div className="pt-12 grid grid-cols-3 gap-4 text-sm text-muted-foreground max-w-md mx-auto">
          <Stat label="Categories" value="16" />
          <Stat label="Providers" value="30+" />
          <Stat label="Avg rating" value="★4.6" />
        </div>
      </header>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard title="Multilingual" body="English, Urdu, Roman Urdu — type how you talk." />
        <FeatureCard title="Agentic AI" body="6 Antigravity-powered agents plan, find, and book." />
        <FeatureCard title="Two-phase booking" body="Real provider acceptance with WhatsApp invitations." />
      </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
