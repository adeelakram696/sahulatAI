import Link from 'next/link';
import SignupForm from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <main className="container max-w-md py-12">
      <header className="text-center mb-8">
        <Link href="/" className="text-xl font-semibold">SahuliatAI</Link>
        <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
      </header>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/auth/signin" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
