import AppHeader from '@/components/layout/app-header';
import SecurityForm from './security-form';

export default function SecurityPage() {
  return (
    <>
      <AppHeader />
      <main className="container max-w-md py-10">
        <h1 className="text-2xl font-bold mb-6">Change password</h1>
        <SecurityForm />
      </main>
    </>
  );
}
