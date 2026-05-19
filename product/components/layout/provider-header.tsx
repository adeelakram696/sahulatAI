/**
 * Provider-side top nav. Mirrors AppHeader's shape but with provider-specific
 * links (Dashboard / Settings) and a "Switch to customer view" affordance in
 * the user menu so providers can also act as customers when needed.
 */
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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
    <header className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-md sticky top-0 z-10">
      <div className="container max-w-4xl flex items-center justify-between py-3">
        <Link href={user ? '/provider/dashboard' : '/'} className="font-semibold tracking-tight flex items-center gap-2 text-white">
          SahuliatAI
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-white/20 text-white px-1.5 py-0.5">
            provider
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <NavLink href="/provider/dashboard" label="Dashboard" active={active === 'dashboard'} />
              <NavLink href="/provider/disputes" label="Disputes" active={active === 'disputes'} />
              <NavLink href="/provider/settings" label="Settings" active={active === 'settings'} />
              <UserMenu email={user.email ?? ''} extraLinks={[{ href: '/chat', label: 'Switch to customer view' }]} />
            </>
          ) : (
            <Link href="/auth/signin" className="font-medium">Sign in</Link>
          )}
        </nav>
      </div>
      {businessName && (
        <div className="container max-w-4xl pb-2 text-xs text-white/80">
          Acting as <span className="font-semibold text-white">{businessName}</span>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={active ? 'font-semibold text-white' : 'text-white/80 hover:text-white'}>
      {label}
    </Link>
  );
}
