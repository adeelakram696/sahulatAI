import Link from 'next/link';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/lib/services/categories';

function chatHref(category: ServiceCategory, authed: boolean) {
  const search = new URLSearchParams({ q: category.prompt_en, slug: category.slug, autosubmit: '1' });
  const target = `/chat?${search.toString()}`;
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}

export default function QuickChips({ authed }: { authed: boolean }) {
  const items = SERVICE_CATEGORIES.filter((c) => c.is_quick);

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none">
      <ul role="list" className="flex gap-2 pb-1">
        {items.map((c, i) => (
          <li
            key={c.slug}
            className="shrink-0 animate-slide-up"
            style={{ animationDelay: `${i * 35}ms`, animationFillMode: 'both' }}
          >
            <Link
              href={chatHref(c, authed)}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card pl-2 pr-3.5 py-1.5 text-[13px] font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97] transition-all shadow-xs"
            >
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-[13px] leading-none">
                <span aria-hidden>{c.emoji}</span>
              </span>
              <span className="tracking-tight">{c.label_en}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
