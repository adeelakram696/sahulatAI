import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';
import { runWorkflow } from '@/lib/antigravity/runtime';

const Body = z.object({ token: z.string().min(32).max(64) });

// How long an invitation token stays acceptable after it was sent.
const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const ACCEPTABLE_STATUSES = ['invitation_sent', 'query_sent'];

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return new Response('invalid token', { status: 400 }); }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, slot_start, customer_user_id, provider_id, agent_run_id, invitation_token, invitation_sent_at, providers(business_name)')
    .eq('invitation_token', body.token)
    .single();
  if (!booking) return new Response('not found', { status: 404 });

  if (booking.status === 'confirmed') {
    return Response.json({ status: 'already_confirmed', booking_id: booking.id });
  }
  if (!ACCEPTABLE_STATUSES.includes(booking.status)) {
    return Response.json({ status: 'invalid_state', current: booking.status }, { status: 409 });
  }
  const sentAt = booking.invitation_sent_at ? new Date(booking.invitation_sent_at).getTime() : null;
  if (sentAt && Date.now() - sentAt > INVITATION_TTL_MS) {
    return Response.json({ status: 'expired' }, { status: 410 });
  }

  await admin
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', booking.id);

  // Trigger Planner → Followup to enqueue reminders.
  await runWorkflow({
    event: 'booking_confirmed',
    payload: { booking_id: booking.id },
    userId: booking.customer_user_id,
    runId: booking.agent_run_id ?? undefined,
  }).catch((e) => console.error('[accept] followup workflow failed:', e));

  return Response.json({
    status: 'confirmed',
    booking_id: booking.id,
    provider: (booking.providers as { business_name?: string } | null)?.business_name,
  });
}
