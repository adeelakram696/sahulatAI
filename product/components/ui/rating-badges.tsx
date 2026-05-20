import { Star } from 'lucide-react';

/**
 * Shows a provider's two ratings side by side: the SahuliatAI portal rating
 * (our own customer reviews) and the Google Places rating.
 */
export function RatingBadges({
  portalRating,
  portalCount,
  googleRating,
  className = '',
  size = 'sm',
}: {
  portalRating: number;
  portalCount: number;
  googleRating: number;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const hasPortal = portalCount > 0;
  const hasGoogle = googleRating > 0;
  const text = size === 'md' ? 'text-[12px]' : 'text-[11px]';
  const star = size === 'md' ? 'size-3.5' : 'size-3';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* SahuliatAI portal rating — our own feature */}
      <span className={`inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary ${text}`}>
        <Star className={`${star} fill-current`} strokeWidth={0} />
        {hasPortal ? (
          <>
            {portalRating.toFixed(1)}
            <span className="font-medium text-primary/70">SahuliatAI</span>
            <span className="font-normal text-primary/55">({portalCount})</span>
          </>
        ) : (
          <span className="font-medium text-primary/75">New on SahuliatAI</span>
        )}
      </span>

      {/* Google Places rating */}
      {hasGoogle && (
        <span className={`inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground ${text}`}>
          <Star className={`${star} fill-amber-400 text-amber-400`} strokeWidth={0} />
          {googleRating.toFixed(1)}
          <span className="font-medium">Google</span>
        </span>
      )}
    </div>
  );
}
