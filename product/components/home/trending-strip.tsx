import Link from 'next/link';
import { Flame } from 'lucide-react';
import { getCategory, type ServiceCategory } from '@/lib/services/categories';
import { ServiceIcon } from '@/components/ui/service-icon';

const TRENDING_SLUGS = ['cook', 'beautician', 'tutor', 'mobile_repair', 'car_wash', 'painter'];

const SIGNAL: Record<string, string> = {
  cook:          'Frequently booked',
  beautician:    'Trending today',
  tutor:         'Back-to-school',
  mobile_repair: 'Same-day fix',
  car_wash:      'Weekend pick',
  painter:       'Pre-Eid demand',
};

function chatHref(category: ServiceCategory, authed: boolean) {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}

export default function TrendingStrip({ authed }: { authed: boolean }) {
  const items = TRENDING_SLUGS
    .map((slug) => getCategory(slug))
    .filter((c): c is ServiceCategory => Boolean(c));

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none">
      <ul role="list" className="flex gap-2.5 pb-2 snap-x">
        {items.map((c, i) => (
          <li
            key={c.slug}
            className="snap-start shrink-0 animate-slide-up"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
          >
            <Link
              href={chatHref(c, authed)}
              className="group flex w-[156px] flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-md active:scale-[0.97] transition-all"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <ServiceIcon
                  slug={c.slug}
                  size="md"
                  className="transition-transform group-hover:scale-105"
                />
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400">
                  <Flame className="size-2.5" strokeWidth={2.5} />
                  Hot
                </span>
              </div>

              <div>
                <p className="text-[13.5px] font-semibold tracking-tight text-foreground leading-tight">
                  {c.label_en}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {SIGNAL[c.slug]}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
