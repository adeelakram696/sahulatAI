import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import SignOutButton from '@/components/profile/sign-out-button';
import {
  MapPin,
  Shield,
  Calendar,
  Wrench,
  Briefcase,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/profile');

  const [{ count: locationCount }, { count: bookingCount }, { data: providerRow }, { count: disputeCount }] = await Promise.all([
    supabase.from('user_locations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_user_id', user.id),
    supabase.from('providers').select('id, business_name').eq('owner_user_id', user.id).maybeSingle(),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('opened_by', user.id),
  ]);

  const displayName = user.email
    ? user.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'There';
  const initial = (user.email ?? '?').charAt(0).toUpperCase();
  const joinedDate = new Date(user.created_at ?? Date.now());
  const memberSince = joinedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <AppHeader active="profile" />
      <main className="relative overflow-hidden container max-w-2xl py-5 sm:py-8 space-y-4 sm:space-y-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl -z-10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.08),transparent_70%)] blur-3xl -z-10"
        />

        {/* Hero card */}
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-secondary/40 p-5 sm:p-6 shadow-sm">
          <span aria-hidden className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="size-16 sm:size-20 rounded-2xl bg-brand-gradient text-white font-display font-extrabold text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-md ring-2 ring-white dark:ring-card">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                Account
              </p>
              <h1 className="mt-1 font-display font-extrabold text-xl sm:text-2xl tracking-tight text-foreground truncate">
                {displayName}
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground truncate">
                {user.email}
              </p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full text-[10.5px] font-semibold px-2 py-0.5 ${
                    providerRow
                      ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {providerRow ? 'Provider' : 'Customer'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Joined {memberSince}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-2.5">
          <Stat label="Bookings" value={bookingCount ?? 0} Icon={Calendar} tint="sky" />
          <Stat label="Saved locations" value={locationCount ?? 0} Icon={MapPin} tint="emerald" />
          <Stat
            label="Disputes"
            value={disputeCount ?? 0}
            Icon={AlertCircle}
            tint={(disputeCount ?? 0) > 0 ? 'rose' : 'slate'}
            emphasize={(disputeCount ?? 0) > 0}
          />
          <Stat
            label="Account"
            value={providerRow ? 'Provider' : 'Customer'}
            Icon={Wrench}
            tint="violet"
          />
        </section>

        {/* Menu */}
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs divide-y divide-border/60">
          <Row href="/profile/locations" Icon={MapPin} tint="emerald" title="Locations" subtitle="Add or edit saved addresses" />
          <Row href="/bookings" Icon={Calendar} tint="sky" title="My bookings" subtitle="History, ratings, and disputes" />
          <Row href="/profile/security" Icon={Shield} tint="violet" title="Security" subtitle="Change password, manage sessions" />
          {providerRow && (
            <Row
              href="/provider/dashboard"
              Icon={Briefcase}
              tint="primary"
              title="Provider dashboard"
              subtitle={providerRow.business_name}
            />
          )}
        </section>

        {/* Sign out */}
        <section className="pt-1">
          <SignOutButton />
        </section>

        <footer className="text-center text-[11px] text-muted-foreground pt-2 pb-4">
          SahuliatAI · informal-economy services for Pakistan
        </footer>
      </main>
    </>
  );
}

type Tint = 'sky' | 'emerald' | 'rose' | 'violet' | 'amber' | 'slate' | 'primary';

const TINTS: Record<Tint, { bg: string; icon: string }> = {
  sky:     { bg: 'bg-sky-100 dark:bg-sky-950/40',         icon: 'text-sky-600 dark:text-sky-400' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', icon: 'text-emerald-600 dark:text-emerald-400' },
  rose:    { bg: 'bg-rose-100 dark:bg-rose-950/40',       icon: 'text-rose-600 dark:text-rose-400' },
  violet:  { bg: 'bg-violet-100 dark:bg-violet-950/40',   icon: 'text-violet-600 dark:text-violet-400' },
  amber:   { bg: 'bg-amber-100 dark:bg-amber-950/40',     icon: 'text-amber-600 dark:text-amber-400' },
  slate:   { bg: 'bg-slate-100 dark:bg-slate-800',        icon: 'text-slate-500 dark:text-slate-400' },
  primary: { bg: 'bg-primary/10',                          icon: 'text-primary' },
};

function Stat({
  label,
  value,
  Icon,
  tint,
  emphasize,
}: {
  label: string;
  value: number | string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: Tint;
  emphasize?: boolean;
}) {
  const t = TINTS[tint];
  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-xs transition-colors ${
        emphasize
          ? 'border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-50 to-card dark:from-rose-950/20 dark:to-card'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className={`inline-flex size-7 items-center justify-center rounded-lg ${t.bg}`}>
          <Icon className={`size-3.5 ${t.icon}`} strokeWidth={2.2} />
        </span>
      </div>
      <p className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-foreground leading-none">
        {value}
      </p>
    </div>
  );
}

function Row({
  href,
  Icon,
  tint,
  title,
  subtitle,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: Tint;
  title: string;
  subtitle: string;
}) {
  const t = TINTS[tint];
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors active:bg-accent/60"
    >
      <span className={`inline-flex size-9 items-center justify-center rounded-xl ${t.bg} shrink-0`}>
        <Icon className={`size-4 ${t.icon}`} strokeWidth={2.2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground tracking-tight">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}
