type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { wrap: string; icon: string; text: string; gap: string }> = {
  sm: { wrap: 'size-7 rounded-lg',   icon: 'size-4', text: 'text-[15px]', gap: 'gap-2' },
  md: { wrap: 'size-9 rounded-xl',   icon: 'size-5', text: 'text-xl',     gap: 'gap-2.5' },
  lg: { wrap: 'size-16 rounded-2xl', icon: 'size-8', text: 'text-2xl',    gap: 'gap-3' },
};

export function BrandIcon({ size = 'sm', className = '' }: { size?: Size; className?: string }) {
  const s = SIZES[size];
  return (
    <span
      className={`${s.wrap} bg-brand-gradient flex items-center justify-center shadow-primary-sm ring-1 ring-inset ring-white/15 shrink-0 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${s.icon} text-white`} aria-hidden>
        <path d="M6 4 L14 4 L14 10 L20 10 L20 19 A2 2 0 0 1 18 21 L6 21 A2 2 0 0 1 4 19 L4 6 A2 2 0 0 1 6 4 Z" />
        <path d="M18 2 C18 3.5 16.5 5 15 5 C16.5 5 18 6.5 18 8 C18 6.5 19.5 5 21 5 C19.5 5 18 3.5 18 2 Z" />
      </svg>
    </span>
  );
}

export function BrandMark({ size = 'sm' }: { size?: Size }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      <BrandIcon size={size} />
      <span className={`font-display font-bold ${s.text} tracking-tight text-foreground group-hover:text-primary transition-colors`}>
        Sahuliat<span className="text-primary">AI</span>
      </span>
    </span>
  );
}
