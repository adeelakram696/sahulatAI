/**
 * Shared top navigation. Server component — reads auth state and conditionally
 * renders signed-in nav (Chat / My bookings / user menu) vs visitor nav
 * (List your service / Sign in).
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import UserMenu from './user-menu';

export default async function AppHeader({ active }: { active?: 'chat' | 'bookings' | 'locations' | 'security' }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="border-b border-border bg-background sticky top-0 z-10">
      <div className="container max-w-3xl flex items-center justify-between py-3">
        <Link href={user ? '/chat' : '/'} className="font-semibold tracking-tight">
          SahuliatAI
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <NavLink href="/chat" label="Chat" active={active === 'chat'} />
              <NavLink href="/bookings" label="My bookings" active={active === 'bookings'} />
              <UserMenu email={user.email ?? ''} />
            </>
          ) : (
            <>
              <Link href="/for-business" className="text-muted-foreground hover:text-foreground">
                List your service
              </Link>
              <Link href="/auth/signin" className="font-medium">
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href}
      className={active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}>
      {label}
    </Link>
  );
}
