import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  booking_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return new Response('invalid', { status: 400 }); }

  // The booking must exist, belong to this customer, and be completed.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, customer_user_id, provider_id')
    .eq('id', body.booking_id)
    .maybeSingle();
  if (!booking) return Response.json({ error: 'booking_not_found' }, { status: 404 });
  if (booking.customer_user_id !== user.id) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (booking.status !== 'completed') {
    return Response.json({ error: 'not_completed', current: booking.status }, { status: 400 });
  }

  const { error } = await supabase.from('ratings').insert({
    booking_id: body.booking_id,
    provider_id: booking.provider_id,
    stars: body.stars,
    comment: body.comment,
  });
  if (error) {
    if (error.code === '23505') return Response.json({ error: 'already_rated' }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const bookingId = req.nextUrl.searchParams.get('booking_id');
  let query = supabase.from('ratings').select('*');
  if (bookingId) query = query.eq('booking_id', bookingId);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ratings: data ?? [] });
}
