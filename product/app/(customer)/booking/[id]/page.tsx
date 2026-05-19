import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BookingRealtime from '@/components/booking/booking-realtime';
import AppHeader from '@/components/layout/app-header';

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_channel, invitation_sent_at, complexity, price_breakdown, en_route_at, arrived_at, completed_at, service_checklist, providers(business_name, phone, rating_avg)')
    .eq('id', id)
    .eq('customer_user_id', user.id)
    .single();

  if (!booking) notFound();
  return (
    <>
      <AppHeader active="bookings" />
      <BookingRealtime initial={booking} />
    </>
  );
}
