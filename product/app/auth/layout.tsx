export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.22),transparent_70%)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-32 size-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.10),transparent_70%)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-[radial-gradient(closest-side,hsl(168_84%_30%/0.14),transparent_70%)] blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
