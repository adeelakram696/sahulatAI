import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import SignOutButton from '@/components/profile/sign-out-button';
import { MapPin, Shield, Calendar, Wrench, Briefcase, AlertCircle } from 'lucide-react';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin?next=/profile');

  const [{ count: locationCount }, { count: bookingCount }, { data: providerRow }, { count: disputeCount }] = await Promise.all([
    supabase.from('user_locations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_user_id', user.id),
    supabase.from('providers').select('id, business_name').eq('owner_user_id', user.id).maybeSingle(),
    supabase.from('disputes').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <>
      <AppHeader active="profile" />
      <main className="container max-w-2xl py-8 space-y-6">
        <header className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold">
            {(user.email ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{user.email}</h1>
            <p className="text-xs text-muted-foreground">Member since {new Date(user.created_at ?? Date.now()).toLocaleDateString()}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <Stat icon={Calendar} label="Bookings" value={bookingCount ?? 0} />
          <Stat icon={MapPin} label="Saved locations" value={locationCount ?? 0} />
          <Stat icon={AlertCircle} label="Disputes" value={disputeCount ?? 0} />
          <Stat icon={Wrench} label="Account" value={providerRow ? 'Provider' : 'Customer'} />
        </section>

        <section className="rounded-lg border border-border bg-card divide-y divide-border">
          <Row href="/profile/locations" icon={MapPin} title="Locations" subtitle="Add or edit saved addresses" />
          <Row href="/bookings" icon={Calendar} title="My bookings" subtitle="History, ratings, and disputes" />
          <Row href="/profile/security" icon={Shield} title="Security" subtitle="Change password, manage sessions" />
          {providerRow && (
            <Row href="/provider/dashboard" icon={Briefcase} title="Provider dashboard" subtitle={providerRow.business_name} />
          )}
        </section>

        <section className="pt-2">
          <SignOutButton />
        </section>

        <footer className="text-center text-[11px] text-muted-foreground pt-4">
          SahuliatAI · informal-economy services for Pakistan
        </footer>
      </main>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
      <Icon className="size-5 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Row({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 hover:bg-accent transition">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="text-muted-foreground">→</span>
    </Link>
  );
}
