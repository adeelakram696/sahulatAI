'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { LogOut, MapPin, Lock, ChevronDown } from 'lucide-react';

export default function UserMenu({
  email,
  extraLinks = [],
}: {
  email: string;
  extraLinks?: Array<{ href: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function logout() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setPending(false);
    if (error) return toast.error(error.message);
    router.replace('/');
    router.refresh();
  }

  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium shadow-xs hover:bg-accent transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center justify-center size-6 rounded-md bg-brand-gradient text-white text-[11px] font-bold shadow-primary-sm">
          {initials}
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-lg z-50 animate-scale-in overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 bg-muted/40 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center size-8 rounded-lg bg-brand-gradient text-white text-sm font-bold shadow-primary-sm shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">Signed in as</p>
                <p className="text-xs font-semibold truncate text-foreground">{email}</p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="p-1.5">
            {extraLinks.map((l) => (
              <MenuLink key={l.href} href={l.href} label={l.label} onClick={() => setOpen(false)} />
            ))}
            <MenuLink href="/profile/locations" label="Saved locations" icon={MapPin} onClick={() => setOpen(false)} />
            <MenuLink href="/profile/security" label="Change password" icon={Lock} onClick={() => setOpen(false)} />
          </div>

          {/* Sign out */}
          <div className="p-1.5 border-t border-border">
            <button
              onClick={logout}
              disabled={pending}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 transition-colors"
            >
              <LogOut className="size-3.5" />
              {pending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
    >
      {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      {label}
    </Link>
  );
}
