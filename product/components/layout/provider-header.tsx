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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-xs">
      <div className="container max-w-4xl flex h-14 items-center justify-between gap-4">

        {/* Brand */}
        <Link href={user ? '/provider/dashboard' : '/'} className="flex items-center gap-2 shrink-0 group">
          <div className="size-7 rounded-lg bg-brand-gradient flex items-center justify-center shadow-primary-sm">
            <svg viewBox="0 0 20 20" fill="none" className="size-4 text-white" aria-hidden>
              <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-3 8.5a3 3 0 0 1 6 0H7Z" fill="currentColor"/>
            </svg>
          </div>
          <span className="font-display font-700 text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors">
            SahuliatAI
          </span>
          <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider rounded-full border border-primary/30 bg-primary/8 text-primary px-2 py-0.5">
            Provider
          </span>
        </Link>

        {/* Nav */}
        {user && (
          <nav className="flex items-center gap-1">
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

      {businessName && (
        <div className="container max-w-4xl pb-1.5">
          <p className="text-[11px] text-muted-foreground">
            Acting as <span className="font-semibold text-foreground">{businessName}</span>
          </p>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors hidden md:inline-flex ${
        active
          ? 'text-primary bg-primary/8'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {label}
    </Link>
  );
}
