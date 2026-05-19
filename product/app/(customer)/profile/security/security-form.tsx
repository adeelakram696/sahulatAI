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
    if (pwd.length < 8) return toast.error('Password must be at least 8 characters');
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPending(false);
    if (error) return toast.error(error.message);
    toast.success('Password updated');
    setPwd('');
    setConfirm('');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Min. 8 characters"
          className="input-field"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">Confirm new password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="input-field"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full !py-2.5 !text-sm mt-1">
        {pending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
