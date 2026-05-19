'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '';
  // Strip leading slash + only keep paths starting with / for safety.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [registerProvider, setRegisterProvider] = useState(safeNext === '/provider/onboarding');

  const finalNext = registerProvider ? '/provider/onboarding' : (safeNext || '/onboarding/location');

  // Where to send the user after Supabase verifies the magic link (email flow).
  // We pass `?next=` through so the destination is preserved through verification.
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

    // If email confirmation is OFF (recommended for hackathon), Supabase returns
    // a session immediately — the user is now signed in.
    // If it's ON, no session is returned and the user must verify via email.
    if (data.session) {
      setPending(false);
      router.push(finalNext);
      router.refresh();
      return;
    }

    // No session — email verification required.
    setPending(false);
    toast.success('Check your email to verify your account.');
    router.push(`/auth/signin?verified=pending${finalNext ? `&next=${encodeURIComponent(finalNext)}` : ''}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {safeNext === '/provider/onboarding' ? (
        <div className="rounded-md border border-purple-200 bg-purple-50 dark:bg-purple-950/10 p-3 text-xs">
          <p className="font-medium">Listing your business?</p>
          <p className="text-muted-foreground mt-0.5">
            We&apos;ll create your account and take you to provider onboarding next.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-purple-100 bg-purple-50/50 dark:bg-purple-950/5 dark:border-purple-900/30 p-3 text-xs">
          <input
            type="checkbox"
            id="registerProvider"
            checked={registerProvider}
            onChange={(e) => setRegisterProvider(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <label htmlFor="registerProvider" className="font-medium cursor-pointer text-foreground">
            I want to list my business (Service Provider)
          </label>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Confirm password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
