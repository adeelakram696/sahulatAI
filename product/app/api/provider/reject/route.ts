import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';

const Body = z.object({ token: z.string().min(32).max(64) });

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return new Response('invalid', { status: 400 }); }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('invitation_token', body.token)
    .single();
  if (!booking) return new Response('not found', { status: 404 });
  if (!['invitation_sent', 'query_sent'].includes(booking.status)) {
    return Response.json({ status: 'invalid_state', current: booking.status }, { status: 409 });
  }
  await admin.from('bookings').update({ status: 'rejected' }).eq('id', booking.id);
  return Response.json({ status: 'rejected', booking_id: booking.id });
}
