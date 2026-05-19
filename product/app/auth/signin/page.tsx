import Link from 'next/link';
import SigninForm from '@/components/auth/signin-form';

export default async function SigninPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next;

  return (
    <main className="container max-w-md py-12">
      <header className="text-center mb-8">
        <Link href="/" className="text-xl font-semibold">SahuliatAI</Link>
        <h1 className="mt-6 text-2xl font-bold">Sign in</h1>
      </header>
      <SigninForm />
      <div className="text-center text-sm text-muted-foreground mt-6 space-y-2">
        <p>
          <Link href="/auth/forgot" className="hover:underline">Forgot password?</Link>
        </p>
        <p>
          Don&apos;t have an account?{' '}
          <Link 
            href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} 
            className="font-medium text-foreground hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
