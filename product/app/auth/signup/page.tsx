import Link from 'next/link';
import SignupForm from '@/components/auth/signup-form';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="size-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-primary-sm">
              <svg viewBox="0 0 20 20" fill="none" className="size-5 text-white" aria-hidden>
                <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-3 8.5a3 3 0 0 1 6 0H7Z" fill="currentColor"/>
              </svg>
            </div>
            <span className="font-display font-700 text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              SahuliatAI
            </span>
          </Link>
        </div>

        <div className="card-elevated p-7">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-700 tracking-tight text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start booking services in seconds — it&apos;s free</p>
          </div>
          <SignupForm />
          <div className="mt-5 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href={`/auth/signin${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
