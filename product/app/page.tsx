import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import { SERVICE_CATEGORIES } from '@/lib/services/categories';
import { ServiceIcon } from '@/components/ui/service-icon';
import { ArrowRight, Sparkles, MapPin, MessageCircle } from 'lucide-react';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const quick = SERVICE_CATEGORIES.filter((c) => c.is_quick);

  return (
    <>
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-hero-gradient opacity-[0.07] dark:opacity-[0.12]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(168_84%_26%/0.12),transparent)]" />

          <div className="container max-w-3xl relative pt-14 pb-12 md:pt-20 md:pb-16 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary mb-6">
              <Sparkles className="size-3" />
              AI-powered service booking
            </div>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-800 tracking-tight text-foreground mb-4 leading-[1.1]">
              What service do you{' '}
              <span className="text-gradient">need today?</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-lg mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
              Describe your problem in Urdu, Roman Urdu, or English — our AI finds and books the right provider near you.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <Link
                href={user ? '/chat' : '/auth/signup?next=/chat'}
                className="btn-primary gap-2 !px-6 !py-3 !text-sm"
              >
                <MessageCircle className="size-4" />
                {user ? 'Open AI chat' : 'Get started free'}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={user ? '/map' : '/auth/signup?next=/map'}
                className="btn-ghost gap-2 !px-6 !py-3 !text-sm"
              >
                <MapPin className="size-4 text-muted-foreground" />
                Browse on map
              </Link>
            </div>

            {/* Trust line */}
            <p className="mt-6 text-xs text-muted-foreground/70">
              Works in Urdu, Roman Urdu & English · No download needed
            </p>
          </div>
        </section>

        {/* Quick chips */}
        <section className="container max-w-3xl pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Most popular</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {quick.map((c) => (
              <CategoryChip key={c.slug} category={c} authed={!!user} />
            ))}
          </div>
        </section>

        {/* Full grid */}
        <section className="container max-w-3xl py-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">All services</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
            {SERVICE_CATEGORIES.map((c) => (
              <CategoryTile key={c.slug} category={c} authed={!!user} />
            ))}
          </div>
        </section>

        {/* Provider CTA */}
        <section className="container max-w-3xl py-8 pb-12">
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <ServiceIcon slug="appliance_repair" size="lg" />
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-display font-700 text-base text-foreground">Are you a service provider?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">List your business and receive AI-matched customer requests directly.</p>
            </div>
            <Link href="/for-business" className="btn-ghost !text-xs !py-2 !px-4 shrink-0">
              List your service →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function CategoryChip({ category, authed }: { category: typeof SERVICE_CATEGORIES[number]; authed: boolean }) {
  return (
    <Link
      href={chatHref(category, authed)}
      className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-card hover:bg-accent hover:border-primary/30 hover:text-primary pl-1.5 pr-3.5 py-1.5 text-xs font-medium transition-all shadow-xs"
    >
      <ServiceIcon slug={category.slug} size="sm" />
      <span>{category.label_en}</span>
    </Link>
  );
}

function CategoryTile({ category, authed }: { category: typeof SERVICE_CATEGORIES[number]; authed: boolean }) {
  return (
    <Link
      href={chatHref(category, authed)}
      className="group flex flex-col items-center rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all p-2.5 sm:p-3.5 text-center gap-1.5 sm:gap-2"
    >
      <ServiceIcon slug={category.slug} size="md" className="transition-transform group-hover:scale-105" />
      <div className="text-[10px] sm:text-[11px] font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
        {category.label_en}
      </div>
    </Link>
  );
}

function chatHref(category: typeof SERVICE_CATEGORIES[number], authed: boolean): string {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}
