import Link from 'next/link';
import { BrandMark } from '@/components/ui/brand-mark';
import SigninForm from '@/components/auth/signin-form';

export default async function SigninPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="group inline-block">
            <BrandMark size="md" />
          </Link>
        </div>

        <div className="card-elevated p-7">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>
          <SigninForm />
          <div className="mt-5 pt-5 border-t border-border text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link href="/auth/forgot" className="font-medium text-primary hover:underline">
                Forgot your password?
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
