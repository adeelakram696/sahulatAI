import Link from 'next/link';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/lib/services/categories';
import { ServiceIcon } from '@/components/ui/service-icon';

function chatHref(category: ServiceCategory, authed: boolean) {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}

export default function BrowseGrid({ authed }: { authed: boolean }) {
  const items = SERVICE_CATEGORIES.filter((c) => !c.is_quick);

  return (
    <ul role="list" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
      {items.map((c, i) => (
        <li
          key={c.slug}
          className="animate-slide-up"
          style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
        >
          <Link
            href={chatHref(c, authed)}
            className="group h-full flex flex-col items-center justify-start gap-2 rounded-xl border border-border/70 bg-card p-3 text-center hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97] transition-all"
          >
            <ServiceIcon
              slug={c.slug}
              size="md"
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-[11.5px] sm:text-[12px] font-medium leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {c.label_en}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
