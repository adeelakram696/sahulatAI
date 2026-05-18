'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function SecurityForm() {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) return toast.error('Passwords do not match');
    if (pwd.length < 8) return toast.error('Min 8 chars');
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPending(false);
    if (error) return toast.error(error.message);
    toast.success('Password updated');
    setPwd(''); setConfirm('');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">New password</label>
        <input type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Confirm</label>
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending}
        className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50">
        {pending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
