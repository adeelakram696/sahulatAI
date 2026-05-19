import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/layout/app-header';
import DisputeForm from '@/components/booking/dispute-form';

function readProvider(p: unknown): { business_name: string } | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : (p as { business_name: string });
}

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signin?next=/bookings/${id}/dispute`);

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, slot_start, service_category, location_text, providers(business_name)')
    .eq('id', id)
    .eq('customer_user_id', user.id)
    .single();
  if (!booking) notFound();

  return (
    <>
      <AppHeader active="bookings" />
      <main className="container max-w-2xl py-8">
        <h1 className="text-xl font-semibold mb-1">Report an issue</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tell us what went wrong with your booking with{' '}
          <span className="font-medium">{readProvider(booking.providers)?.business_name}</span>.
          Our resolution agent reviews disputes within minutes.
        </p>
        <DisputeForm bookingId={booking.id} />
      </main>
    </>
  );
}
