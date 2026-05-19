import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/ui/brand-mark';
import UserMenu from './user-menu';

export default async function ProviderHeader({
  active,
  businessName,
}: {
  active?: 'dashboard' | 'settings' | 'disputes';
  businessName?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="container max-w-4xl flex h-14 items-center justify-between gap-4">

        {/* Brand */}
        <Link href={user ? '/provider/dashboard' : '/'} className="group flex items-center gap-2 shrink-0">
          <BrandMark size="sm" />
          <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider rounded-full border border-primary/30 bg-primary/8 text-primary px-2 py-0.5">
            Provider
          </span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/provider/dashboard" label="Dashboard" active={active === 'dashboard'} />
            <NavLink href="/provider/disputes" label="Disputes" active={active === 'disputes'} />
            <NavLink href="/provider/settings" label="Settings" active={active === 'settings'} />
          </nav>
        )}

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <UserMenu email={user.email ?? ''} extraLinks={[{ href: '/chat', label: 'Switch to customer view' }]} />
          ) : (
            <Link href="/auth/signin" className="btn-ghost !py-1.5 !px-4 !text-xs">Sign in</Link>
          )}
        </div>
      </div>

      {/* Mobile tab nav */}
      {user && (
        <div className="md:hidden border-t border-border/40">
          <div className="container max-w-4xl flex">
            <MobileNavTab href="/provider/dashboard" label="Dashboard" active={active === 'dashboard'} />
            <MobileNavTab href="/provider/disputes" label="Disputes" active={active === 'disputes'} />
            <MobileNavTab href="/provider/settings" label="Settings" active={active === 'settings'} />
          </div>
        </div>
      )}

    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        active ? 'text-primary bg-primary/8' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {label}
      {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />}
    </Link>
  );
}

function MobileNavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 text-center py-2.5 text-xs font-semibold border-b-2 transition-colors ${
        active
          ? 'text-primary border-primary'
          : 'text-muted-foreground border-transparent hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
