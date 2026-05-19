import Link from 'next/link';
import { BrandMark } from '@/components/ui/brand-mark';
import SignupForm from '@/components/auth/signup-form';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="group inline-block">
            <BrandMark size="md" />
          </Link>
        </div>

        <div className="card-elevated p-7">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
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
