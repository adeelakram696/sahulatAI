'use client';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AcceptForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<null | 'accepted' | 'rejected'>(null);

  async function handle(action: 'accept' | 'reject') {
    setPending(true);
    const url = action === 'accept' ? '/api/provider/accept' : '/api/provider/reject';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(`Could not ${action}`);
      return;
    }
    setDone(action === 'accept' ? 'accepted' : 'rejected');
  }

  if (done === 'accepted') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm">
        <p className="font-medium">Accepted ✓</p>
        <p className="text-muted-foreground mt-1">The customer has been notified.</p>
      </div>
    );
  }
  if (done === 'rejected') {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm">
        <p className="font-medium">Rejected</p>
        <p className="text-muted-foreground mt-1">The customer will be offered alternatives.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => handle('reject')} disabled={pending}
        className="rounded-md border border-border py-3 text-sm font-medium hover:bg-accent disabled:opacity-50">
        Reject
      </button>
      <button onClick={() => handle('accept')} disabled={pending}
        className="rounded-md bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-50">
        {pending ? 'Working…' : 'Accept'}
      </button>
    </div>
  );
}
