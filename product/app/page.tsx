import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import { SERVICE_CATEGORIES } from '@/lib/services/categories';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const quick = SERVICE_CATEGORIES.filter((c) => c.is_quick);

  return (
    <>
      <AppHeader />
      <main className="container max-w-3xl py-8 md:py-12">
        <header className="text-center space-y-4 mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            What service do you need today?
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Tap a category, or open the chat to describe your need in any language.
          </p>
          <div className="pt-2 flex gap-2 justify-center flex-wrap">
            <Link
              href={user ? '/chat' : '/auth/signup?next=/chat'}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              {user ? 'Open AI chat →' : 'Get started →'}
            </Link>
            <Link
              href={user ? '/map' : '/auth/signup?next=/map'}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Browse on map
            </Link>
          </div>
        </header>

        {/* Quick row */}
        <section className="mb-8">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Most popular</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            {quick.map((c) => (
              <CategoryChip key={c.slug} category={c} authed={!!user} />
            ))}
          </div>
        </section>

        {/* Full grid */}
        <section>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">All services</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {SERVICE_CATEGORIES.map((c) => (
              <CategoryTile key={c.slug} category={c} authed={!!user} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function CategoryChip({ category, authed }: { category: typeof SERVICE_CATEGORIES[number]; authed: boolean }) {
  const href = chatHref(category, authed);
  return (
    <Link
      href={href}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent px-3 py-1.5 text-xs font-medium"
    >
      <span aria-hidden>{category.emoji}</span>
      <span>{category.label_en}</span>
    </Link>
  );
}

function CategoryTile({ category, authed }: { category: typeof SERVICE_CATEGORIES[number]; authed: boolean }) {
  const href = chatHref(category, authed);
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/40 transition p-4 text-center"
    >
      <div className="text-3xl mb-1.5" aria-hidden>{category.emoji}</div>
      <div className="text-xs font-medium leading-tight">{category.label_en}</div>
    </Link>
  );
}

function chatHref(category: typeof SERVICE_CATEGORIES[number], authed: boolean): string {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}
