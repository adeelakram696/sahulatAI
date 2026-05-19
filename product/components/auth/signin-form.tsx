'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getUserRole } from '@/lib/auth/role';

export default function SigninForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      toast.error(error.message);
      return;
    }
    // Auto-route by role: providers go to their dashboard by default.
    let target = search.get('next');
    if (!target && data.user) {
      const role = await getUserRole(supabase, data.user.id);
      target = role === 'provider' ? '/provider/dashboard' : '/chat';
    }
    setPending(false);
    router.push(target || '/chat');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input-field"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
        <input
          type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="input-field"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full !py-2.5 !text-sm mt-1">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
