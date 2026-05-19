import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';

interface Statement { role: 'customer' | 'provider'; message: string; at: string }
interface Resolution {
  refund_percent: number;
  compensation_credit_pkr: number;
  warn_provider: boolean;
  blacklist_provider: boolean;
  customer_message_en: string;
  customer_message_ur: string;
}

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signin?next=/disputes/${id}`);

  const { data } = await supabase
    .from('disputes')
    .select('id, kind, status, opened_at, resolved_at, statements, resolution, booking_id, bookings(providers(business_name), service_category)')
    .eq('id', id)
    .single();
  if (!data) notFound();

  const bookingRel = Array.isArray(data.bookings) ? (data.bookings[0] ?? null) : (data.bookings as { providers: unknown } | null);
  const providerRel = bookingRel ? (Array.isArray(bookingRel.providers) ? (bookingRel.providers[0] ?? null) : bookingRel.providers) : null;
  const provider = providerRel as { business_name: string } | null;
  const statements = (data.statements ?? []) as Statement[];
  const resolution = data.resolution as Resolution | null;

  const statusColor = {
    open: 'amber',
    under_review: 'blue',
    resolved: 'emerald',
    escalated: 'rose',
  }[data.status as 'open' | 'under_review' | 'resolved' | 'escalated'] ?? 'slate';

  return (
    <>
      <AppHeader active="bookings" />
      <main className="container max-w-2xl py-8 space-y-5">
        <div>
          <Link href={`/booking/${data.booking_id}`} className="text-xs text-muted-foreground hover:underline">
            ← Back to booking
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="text-xl font-semibold">Dispute · {data.kind.replace('_', ' ')}</h1>
            <span className={`text-[10px] uppercase rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-950/30 text-${statusColor}-800 dark:text-${statusColor}-200 px-2 py-0.5 font-medium`}>
              {data.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            About {provider?.business_name} · filed {new Date(data.opened_at).toLocaleString()}
          </p>
        </div>

        {resolution && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resolution</p>
            <p className="text-sm">{resolution.customer_message_en}</p>
            <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-muted-foreground">Refund</span><span className="text-right font-medium">{resolution.refund_percent}%</span>
              {resolution.compensation_credit_pkr > 0 && (
                <>
                  <span className="text-muted-foreground">Credit</span>
                  <span className="text-right font-medium">PKR {resolution.compensation_credit_pkr.toLocaleString('en-IN')}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversation</p>
          {statements.map((s, i) => (
            <div key={i} className={`rounded-md border p-3 text-sm ${s.role === 'customer' ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/10' : 'border-border bg-card'}`}>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                {s.role === 'customer' ? 'You' : provider?.business_name ?? 'Provider'} · {new Date(s.at).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap">{s.message}</p>
            </div>
          ))}
          {statements.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No statements yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
