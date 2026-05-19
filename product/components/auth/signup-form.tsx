'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [registerProvider, setRegisterProvider] = useState(safeNext === '/provider/onboarding');

  const finalNext = registerProvider ? '/provider/onboarding' : (safeNext || '/onboarding/location');

  const emailRedirect = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${
    encodeURIComponent(finalNext)
  }`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) return toast.error('Passwords do not match');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');

    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: emailRedirect },
    });
    if (error) {
      setPending(false);
      toast.error(error.message);
      return;
    }

    if (data.session) {
      setPending(false);
      router.push(finalNext);
      router.refresh();
      return;
    }

    setPending(false);
    toast.success('Check your email to verify your account.');
    router.push(`/auth/signin?verified=pending${finalNext ? `&next=${encodeURIComponent(finalNext)}` : ''}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {safeNext === '/provider/onboarding' ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
          <p className="font-semibold text-foreground">Listing your business?</p>
          <p className="text-muted-foreground mt-0.5">
            We&apos;ll create your account and take you to provider onboarding next.
          </p>
        </div>
      ) : (
        <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3.5 cursor-pointer hover:bg-accent transition-colors">
          <input
            type="checkbox"
            id="registerProvider"
            checked={registerProvider}
            onChange={(e) => setRegisterProvider(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4 shrink-0"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">I want to list my business</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Sign up as a service provider</p>
          </div>
        </label>
      )}

      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input-field"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          className="input-field"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Confirm password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="input-field"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full !py-2.5 !text-sm mt-1"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
