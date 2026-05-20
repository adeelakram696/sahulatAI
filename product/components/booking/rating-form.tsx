'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

type ExistingRating = { stars: number; comment: string | null };

export default function RatingForm({
  bookingId,
  existing,
}: {
  bookingId: string;
  existing?: ExistingRating | null;
}) {
  const [submitted, setSubmitted] = useState<ExistingRating | null>(existing ?? null);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Your rating
        </p>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`size-5 ${n <= submitted.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`}
              strokeWidth={0}
            />
          ))}
        </div>
        {submitted.comment && (
          <p className="text-sm text-foreground/80 mt-2 leading-relaxed">“{submitted.comment}”</p>
        )}
        <p className="text-[12px] text-muted-foreground mt-2">
          Thanks — your rating is now on this provider&apos;s SahuliatAI profile.
        </p>
      </div>
    );
  }

  async function submit() {
    if (stars < 1) {
      toast.error('Pick a star rating first');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, stars, comment: comment.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error === 'already_rated' ? 'You have already rated this booking.'
          : data.error === 'not_completed' ? 'You can only rate a completed service.'
          : data.error || 'Could not submit your rating.',
        );
      }
      setSubmitted({ stars, comment: comment.trim() || null });
      toast.success('Rating submitted — thank you!');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Rate this service</p>
      <p className="text-[12px] text-muted-foreground mt-0.5">
        Your rating appears on the provider&apos;s SahuliatAI profile.
      </p>

      <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="p-0.5 active:scale-90 transition-transform"
          >
            <Star
              className={`size-8 transition-colors ${
                n <= (hover || stars) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'
              }`}
              strokeWidth={0}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)"
        rows={2}
        maxLength={500}
        className="mt-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all"
      />

      <button
        type="button"
        onClick={submit}
        disabled={pending || stars < 1}
        className="btn-primary mt-2 w-full !text-sm disabled:opacity-50"
      >
        {pending ? 'Submitting…' : 'Submit rating'}
      </button>
    </div>
  );
}
