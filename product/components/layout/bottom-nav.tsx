'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, Calendar, Map, User } from 'lucide-react';

const ITEMS = [
  { key: 'home',     href: '/',         label: 'Home',     Icon: Home,          match: (p: string) => p === '/' },
  { key: 'chat',     href: '/chat',     label: 'Chat',     Icon: MessageCircle, match: (p: string) => p === '/chat' || p.startsWith('/chat/') },
  { key: 'map',      href: '/map',      label: 'Map',      Icon: Map,           match: (p: string) => p === '/map' || p.startsWith('/map/') },
  { key: 'bookings', href: '/bookings', label: 'Bookings', Icon: Calendar,      match: (p: string) => p === '/bookings' || p.startsWith('/bookings/') || p.startsWith('/booking/') },
  { key: 'profile',  href: '/profile',  label: 'Account',  Icon: User,          match: (p: string) => p.startsWith('/profile') },
] as const;

export default function BottomNav() {
  const pathname = usePathname() || '/';

  if (
    pathname.startsWith('/provider/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/onboarding')
  ) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl shadow-[0_-1px_0_hsl(var(--border)),0_-4px_16px_rgb(0_0_0_/_0.06)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 h-[60px]">
        {ITEMS.map(({ key, href, label, Icon, match }) => {
          const isActive = match(pathname);
          return (
            <li key={key}>
              <Link
                href={href}
                className="flex flex-col items-center justify-center gap-0.5 h-full transition-colors"
              >
                <span className={`relative flex items-center justify-center rounded-xl p-1.5 transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon className={`size-[19px] transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/70'}`} strokeWidth={isActive ? 2.2 : 1.8} />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
                  )}
                </span>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
