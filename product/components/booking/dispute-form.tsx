'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const KINDS = [
  { value: 'no_show', label: 'Provider did not show up' },
  { value: 'quality', label: 'Work quality was poor' },
  { value: 'price', label: 'Price was higher than agreed' },
  { value: 'cancellation', label: 'Late or last-minute cancellation' },
  { value: 'overrun', label: 'Took much longer than expected' },
  { value: 'damage', label: 'Property or item was damaged' },
] as const;

export default function DisputeForm({ bookingId }: { bookingId: string }) {
  const [kind, setKind] = useState<typeof KINDS[number]['value']>('quality');
  const [statement, setStatement] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (statement.trim().length < 5) {
      toast.error('Please describe the issue in more detail.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, kind, statement: statement.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { dispute_id } = (await res.json()) as { dispute_id: string };
      toast.success('Dispute filed. Our resolution agent will respond shortly.');
      router.push(`/disputes/${dispute_id}`);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to file dispute.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold mb-2 uppercase tracking-wide">What happened?</label>
        <div className="space-y-2">
          {KINDS.map((k) => (
            <label key={k.value} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent cursor-pointer">
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} />
              <span className="text-sm">{k.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-2 uppercase tracking-wide">Describe the issue</label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={5}
          placeholder="Share the details so we can review fairly. Example: 'Plumber arrived 2 hours late and pipe is still leaking.'"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">{statement.length}/2000 characters</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Filing dispute…' : 'File dispute'}
      </button>
    </form>
  );
}
