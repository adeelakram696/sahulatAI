import Link from 'next/link';
import AppHeader from '@/components/layout/app-header';
import SecurityForm from './security-form';

export default function SecurityPage() {
  return (
    <>
      <AppHeader active="security" />
      <main className="container max-w-[400px] py-10">
        <div className="card-elevated p-7">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-700 tracking-tight text-foreground">Change password</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a strong password, at least 8 characters.</p>
          </div>
          <SecurityForm />
          <div className="mt-5 pt-5 border-t border-border text-center">
            <Link href="/bookings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to bookings
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
