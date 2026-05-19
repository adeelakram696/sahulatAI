'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

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
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center rounded-full size-8 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold ring-1 ring-white/30 transition">
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-card shadow-md text-sm py-1 z-20">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Signed in as</p>
            <p className="text-xs truncate">{email}</p>
          </div>
          {extraLinks.map((l) => (
            <MenuLink key={l.href} href={l.href} label={l.label} onClick={() => setOpen(false)} />
          ))}
          <MenuLink href="/profile/locations" label="Locations" onClick={() => setOpen(false)} />
          <MenuLink href="/profile/security" label="Change password" onClick={() => setOpen(false)} />
          <button onClick={logout} disabled={pending}
            className="block w-full text-left px-3 py-2 hover:bg-accent text-rose-600 disabled:opacity-50 border-t border-border mt-1">
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick}
      className="block px-3 py-2 hover:bg-accent">
      {label}
    </Link>
  );
}
