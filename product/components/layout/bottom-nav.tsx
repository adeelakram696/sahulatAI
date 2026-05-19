'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, Calendar, Map, User } from 'lucide-react';

const ITEMS = [
  { key: 'home',     href: '/',           label: 'Home',     match: (p: string) => p === '/' },
  { key: 'chat',     href: '/chat',       label: 'Chat',     match: (p: string) => p === '/chat' || p.startsWith('/chat/') },
  { key: 'map',      href: '/map',        label: 'Map',      match: (p: string) => p === '/map' || p.startsWith('/map/') },
  { key: 'bookings', href: '/bookings',   label: 'Bookings', match: (p: string) => p === '/bookings' || p.startsWith('/bookings/') || p.startsWith('/booking/') },
  { key: 'profile',  href: '/profile',    label: 'Account',  match: (p: string) => p.startsWith('/profile') },
] as const;

const ICONS: Record<typeof ITEMS[number]['key'], React.ComponentType<{ className?: string }>> = {
  home: Home, chat: MessageCircle, map: Map, bookings: Calendar, profile: User,
};

export default function BottomNav() {
  const pathname = usePathname() || '/';
  // Hide on provider, auth, and onboarding pages
  if (
    pathname.startsWith('/provider/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/onboarding')
  ) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.match(pathname);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
