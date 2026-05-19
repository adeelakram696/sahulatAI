'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Zap, Languages, SprayCan, GraduationCap } from 'lucide-react';

type Slide = {
  kicker: string;
  title: string;
  sub: string;
  href: string;
  ctaLabel: string;
  surface: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

function buildHref(target: string, authed: boolean) {
  return authed ? target : `/auth/signup?next=${encodeURIComponent(target)}`;
}

export default function PromoCarousel({ authed }: { authed: boolean }) {
  const slides: Slide[] = [
    {
      kicker: "Today's pick",
      title: 'Book a pro in 2 minutes',
      sub: 'Describe the problem. AI matches a verified local pro.',
      href: buildHref('/chat?autosubmit=0', authed),
      ctaLabel: 'Start chat',
      surface: 'bg-today-hero',
      Icon: Sparkles,
    },
    {
      kicker: 'Featured',
      title: 'AC not cooling? Same-day visit',
      sub: 'Trusted AC technicians across Karachi, Lahore, Islamabad.',
      href: buildHref(
        '/chat?q=' + encodeURIComponent('My AC is not cooling properly') + '&slug=ac_repair&autosubmit=1',
        authed,
      ),
      ctaLabel: 'Book AC repair',
      surface: 'bg-story-night',
      Icon: Zap,
    },
    {
      kicker: 'In your language',
      title: 'Urdu, Roman Urdu, English — all welcome',
      sub: 'Type how you talk. Our AI understands all three.',
      href: buildHref('/chat?autosubmit=0', authed),
      ctaLabel: 'Try in Urdu',
      surface: 'bg-story-violet',
      Icon: Languages,
    },
    {
      kicker: 'Spring clean',
      title: 'Deep clean your home — same day',
      sub: 'Vetted pros for kitchens, bathrooms, full houses.',
      href: buildHref(
        '/chat?q=' + encodeURIComponent('I want house cleaning service') + '&slug=house_cleaning&autosubmit=1',
        authed,
      ),
      ctaLabel: 'Book cleaning',
      surface: 'bg-story-rose',
      Icon: SprayCan,
    },
    {
      kicker: 'Back to school',
      title: 'Find a tutor your kid will love',
      sub: 'Math, Science, Urdu, English — every subject and board.',
      href: buildHref(
        '/chat?q=' + encodeURIComponent('I need a tutor') + '&slug=tutor&autosubmit=1',
        authed,
      ),
      ctaLabel: 'Find a tutor',
      surface: 'bg-story-teal',
      Icon: GraduationCap,
    },
  ];

  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div className="relative">
      <div className="relative h-[220px] sm:h-[260px] overflow-hidden rounded-3xl border border-border/60 shadow-md">
        {slides.map((s, i) => {
          const Icon = s.Icon;
          const isActive = i === active;
          return (
            <Link
              key={s.title}
              href={s.href}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              className={`group absolute inset-0 flex flex-col justify-between p-5 sm:p-6 text-white transition-opacity duration-700 ${s.surface} ${
                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <span className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-white/10 blur-2xl" />
              <span className="pointer-events-none absolute bottom-[-30px] left-[-20px] size-40 rounded-full bg-white/5 blur-2xl" />

              <div className="relative flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                  <Icon className="size-3" strokeWidth={2.5} />
                  {s.kicker}
                </span>
              </div>

              <div className="relative">
                <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] leading-tight tracking-[-0.03em] text-balance">
                  {s.title}
                </h2>
                <p className="mt-1.5 text-[12.5px] sm:text-[13px] text-white/85 leading-snug max-w-[24ch]">
                  {s.sub}
                </p>

                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white text-zinc-900 px-3.5 py-1.5 text-[12.5px] font-semibold shadow-sm group-hover:gap-2 transition-all">
                  {s.ctaLabel}
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? 'w-5 bg-primary' : 'w-1.5 bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
