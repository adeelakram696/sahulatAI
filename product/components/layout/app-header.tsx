import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/ui/brand-mark';
import UserMenu from './user-menu';

export default async function AppHeader({ active }: { active?: 'chat' | 'bookings' | 'locations' | 'security' | 'map' | 'profile' }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="container max-w-3xl flex h-14 items-center justify-between gap-4">

        {/* Brand */}
        <Link href={user ? '/chat' : '/'} className="group shrink-0">
          <BrandMark size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {user ? (
            <>
              <NavLink href="/chat" label="Chat" active={active === 'chat'} />
              <NavLink href="/map" label="Map" active={active === 'map'} />
              <NavLink href="/bookings" label="Bookings" active={active === 'bookings'} />
            </>
          ) : (
            <NavLink href="/for-business" label="List your service" active={false} />
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <UserMenu email={user.email ?? ''} />
          ) : (
            <>
              <Link href="/auth/signin" className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
                Sign in
              </Link>
              <Link href="/auth/signup" className="btn-primary !py-1.5 !px-4 !text-xs">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'text-primary bg-primary/8'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
      )}
    </Link>
  );
}
