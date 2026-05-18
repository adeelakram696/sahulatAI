'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="container max-w-md py-12">
      <header className="text-center mb-8">
        <Link href="/" className="text-xl font-semibold">SahuliatAI</Link>
        <h1 className="mt-6 text-2xl font-bold">Reset password</h1>
      </header>
      {sent ? (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <p className="text-sm">Check your email for a reset link.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit" disabled={pending}
            className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/auth/signin" className="hover:underline">Back to sign in</Link>
      </p>
    </main>
  );
}
