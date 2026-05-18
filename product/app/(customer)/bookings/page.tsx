import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, slot_start, service_category, location_text, providers(business_name)')
    .eq('customer_user_id', user.id)
    .order('slot_start', { ascending: false });

  return (
    <>
      <AppHeader active="bookings" />
      <main className="container max-w-3xl py-10">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My bookings</h1>
        <Link href="/chat" className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5">
          New request
        </Link>
      </header>
      {!bookings || bookings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
          <Link href="/chat" className="mt-3 inline-block text-sm font-medium hover:underline">
            Start a new request →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const prov = Array.isArray(b.providers) ? b.providers[0] : b.providers;
            return (
              <li key={b.id}>
                <Link href={`/booking/${b.id}`}
                  className="block rounded-md border border-border bg-card p-4 hover:bg-accent transition">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{(prov as { business_name?: string })?.business_name ?? 'Provider'}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.service_category.replace('_', ' ')} · {new Date(b.slot_start).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.location_text}</p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </main>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    query_sent:      'bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200',
    invitation_sent: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    confirmed:       'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
    reminded:        'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    in_progress:     'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
    completed:       'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    cancelled:       'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    rejected:        'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-muted'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
