import Link from 'next/link';
import { admin } from '@/lib/supabase/admin';

export default async function ForBusinessPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const params = await searchParams;
  const ref = params.ref;

  let ghost: { business_name: string; phone: string | null; owner_user_id: string | null; pending_count: number } | null = null;
  if (ref) {
    const { data } = await admin
      .from('providers')
      .select('id, business_name, phone, owner_user_id')
      .eq('external_place_id', ref)
      .maybeSingle();
    if (data) {
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', data.id)
        .eq('status', 'query_sent');
      ghost = {
        business_name: data.business_name,
        phone: data.phone,
        owner_user_id: data.owner_user_id,
        pending_count: count ?? 0,
      };
    }
  }

  const signupHref = ref
    ? `/auth/signup?next=${encodeURIComponent(`/provider/onboarding?ref=${ref}`)}`
    : '/auth/signup?next=/provider/onboarding';

  return (
    <main className="container max-w-3xl py-16">
      {ghost && !ghost.owner_user_id && (
        <div className="mb-8 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/10 p-5">
          <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold">Claim your business</p>
          <h2 className="text-xl font-bold mt-1">{ghost.business_name}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            A customer requested your service through SahuliatAI.
            {ghost.pending_count > 0 && (
              <> You have <span className="font-medium text-foreground">{ghost.pending_count} pending booking{ghost.pending_count === 1 ? '' : 's'}</span> waiting.</>
            )}
          </p>
          <Link href={signupHref}
            className="mt-4 inline-flex items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium">
            Claim this business →
          </Link>
        </div>
      )}

      <header className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold">Get more bookings from real customers nearby.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          List your service in 5 simple steps. Get invitations on WhatsApp.
        </p>
      </header>
      <ul className="grid md:grid-cols-3 gap-4 mb-12">
        <Bullet n={1} label="Live bookings" />
        <Bullet n={2} label="WhatsApp invitations" />
        <Bullet n={3} label="Realtime dashboard" />
      </ul>
      <div className="text-center">
        <Link href={signupHref}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium">
          {ghost && !ghost.owner_user_id ? `Claim ${ghost.business_name} →` : 'List your service →'}
        </Link>
      </div>
    </main>
  );
}

function Bullet({ n, label }: { n: number; label: string }) {
  return (
    <li className="rounded-md border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">Feature {n}</span>
      <p className="font-medium mt-1">{label}</p>
    </li>
  );
}
