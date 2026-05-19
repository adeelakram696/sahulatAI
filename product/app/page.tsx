import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import PromoCarousel from '@/components/home/promo-carousel';
import QuickChips from '@/components/home/quick-chips';
import FeaturedStrip from '@/components/home/featured-strip';
import TrendingStrip from '@/components/home/trending-strip';
import BrowseGrid from '@/components/home/browse-grid';
import StatsStrip from '@/components/home/stats-strip';

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: { user } }, providerCountRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('providers').select('id', { count: 'exact', head: true }),
  ]);
  const providerCount = providerCountRes.count ?? null;
  const authed = !!user;

  const chatStartHref = authed ? '/chat' : '/auth/signup?next=/chat';

  return (
    <>
      <AppHeader />
      <main className="pb-12 md:pb-16">

        {/* Welcome + hero promo */}
        <section className="container max-w-3xl pt-4 sm:pt-6">
          <div className="animate-fade-in">
            <h1 className="font-display font-extrabold text-[22px] sm:text-[26px] tracking-[-0.03em] leading-tight text-foreground">
              Welcome to SahuliatAI
            </h1>
            <p className="mt-1.5 text-base sm:text-lg font-medium text-foreground/80 tracking-tight">
              How may I help you today?
            </p>
          </div>

          <div
            className="mt-4 animate-slide-up"
            style={{ animationDelay: '60ms', animationFillMode: 'both' }}
          >
            <PromoCarousel authed={authed} />
          </div>
        </section>

        {/* Quick action chips */}
        <section className="container max-w-3xl pt-5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              Quick actions
            </h2>
            <Link
              href={chatStartHref}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Sparkles className="size-3" strokeWidth={2.5} />
              Ask AI
            </Link>
          </div>
          <QuickChips authed={authed} />
        </section>

        {/* Top picks — large gradient cards */}
        <section className="mt-6 sm:mt-7 bg-secondary/30">
          <div className="container max-w-3xl py-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="font-display font-bold text-[16px] sm:text-[17px] tracking-tight text-foreground">
                  Top picks for you
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Most-requested services across Pakistan
                </p>
              </div>
            </div>
            <FeaturedStrip authed={authed} />
          </div>
        </section>

        {/* Trending */}
        <section className="container max-w-3xl pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-[16px] sm:text-[17px] tracking-tight text-foreground">
                Trending in your city
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                What people are booking right now
              </p>
            </div>
          </div>
          <TrendingStrip authed={authed} />
        </section>

        {/* Trust / social proof */}
        <section className="container max-w-3xl pt-6">
          <StatsStrip providerCount={providerCount} />
        </section>

        {/* Browse all */}
        <section className="container max-w-3xl pt-6">
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-display font-bold text-[16px] sm:text-[17px] tracking-tight text-foreground">
              Browse all services
            </h2>
            <span className="text-[11.5px] font-medium text-muted-foreground">
              12 more
            </span>
          </div>
          <BrowseGrid authed={authed} />
        </section>

      </main>
    </>
  );
}
