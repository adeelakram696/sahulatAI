import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/lib/services/categories';
import { ServiceIcon } from '@/components/ui/service-icon';

const TINT: Record<string, string> = {
  ac_repair:        'from-sky-100 to-sky-50 dark:from-sky-950/60 dark:to-sky-900/20',
  plumber:          'from-blue-100 to-blue-50 dark:from-blue-950/60 dark:to-blue-900/20',
  electrician:      'from-amber-100 to-amber-50 dark:from-amber-950/60 dark:to-amber-900/20',
  house_cleaning:   'from-teal-100 to-teal-50 dark:from-teal-950/60 dark:to-teal-900/20',
};

function chatHref(category: ServiceCategory, authed: boolean) {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}

const TAGLINES: Record<string, string> = {
  ac_repair:      'Same-day cooling fix',
  plumber:        'Leaks & drains sorted',
  electrician:    'Wiring, fans, breakers',
  house_cleaning: 'Deep clean on demand',
};

export default function FeaturedStrip({ authed }: { authed: boolean }) {
  const items = SERVICE_CATEGORIES.filter((c) => c.is_quick);

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none">
      <ul role="list" className="flex gap-3 pb-2 snap-x snap-mandatory">
        {items.map((c, i) => (
          <li
            key={c.slug}
            className="snap-start shrink-0 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
          >
            <Link
              href={chatHref(c, authed)}
              className={`group relative flex flex-col w-[220px] sm:w-[240px] h-[180px] rounded-2xl border border-border/60 bg-gradient-to-br ${TINT[c.slug] ?? 'from-secondary to-card'} p-4 hover:shadow-md active:scale-[0.98] transition-all overflow-hidden`}
            >
              <span className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/40 dark:bg-white/5 blur-xl" />

              <div className="relative flex items-start justify-between">
                <ServiceIcon
                  slug={c.slug}
                  size="lg"
                  className="ring-1 ring-white/40 dark:ring-white/10 shadow-sm transition-transform group-hover:scale-105 group-hover:-translate-y-0.5"
                />
                <span className="rounded-full bg-white/70 dark:bg-card/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                  Popular
                </span>
              </div>

              <div className="relative mt-auto">
                <p className="font-display font-bold text-[16px] tracking-tight text-foreground leading-tight">
                  {c.label_en}
                </p>
                <p className="mt-0.5 text-[12px] text-foreground/65 leading-snug line-clamp-1">
                  {TAGLINES[c.slug]}
                </p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-[11.5px] font-semibold shadow-primary-sm group-hover:gap-2 transition-all">
                  Book
                  <ArrowUpRight className="size-3" strokeWidth={2.5} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
