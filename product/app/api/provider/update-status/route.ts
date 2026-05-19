import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { runWorkflow } from '@/lib/antigravity/runtime';

const Body = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(['en_route', 'arrived', 'in_progress', 'completed', 'cancelled']),
  checklist: z.array(z.object({ key: z.string(), label: z.string(), done: z.boolean() })).optional(),
  photos: z.array(z.string().url()).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response('invalid_request', { status: 400 });
  }

  // Fetch the booking and its associated provider to verify ownership
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('id, status, provider_id, customer_user_id, agent_run_id, providers(owner_user_id)')
    .eq('id', body.booking_id)
    .single();

  if (fetchError || !booking) {
    return new Response('booking_not_found', { status: 404 });
  }

  const providerOwnerId = (booking.providers as any)?.owner_user_id;
  if (providerOwnerId !== user.id) {
    return new Response('forbidden', { status: 403 });
  }

  // Update the booking status + service-quality fields
  const updateData: Record<string, any> = { status: body.status };
  const nowIso = new Date().toISOString();
  if (body.status === 'en_route') updateData.en_route_at = nowIso;
  if (body.status === 'arrived') updateData.arrived_at = nowIso;
  if (body.status === 'completed') updateData.completed_at = nowIso;
  if (body.checklist) updateData.service_checklist = body.checklist;
  if (body.photos) updateData.service_photos = body.photos;

  const { error: updateError } = await admin
    .from('bookings')
    .update(updateData)
    .eq('id', booking.id);

  if (updateError) {
    return new Response(updateError.message, { status: 500 });
  }

  // Trigger relevant followup workflows
  if (body.status === 'completed') {
    // Send rating prompt immediately (or schedule via agent/followup check_completion)
    await runWorkflow({
      event: 'rating_prompt_due',
      payload: { booking_id: booking.id },
      userId: booking.customer_user_id,
      runId: booking.agent_run_id ?? undefined,
    }).catch((e) => console.error('[update-status] rating workflow failed:', e));
  }

  // Service-quality push notifications to the customer (best-effort)
  if (body.status === 'en_route' || body.status === 'arrived' || body.status === 'in_progress') {
    const title = body.status === 'en_route'
      ? 'Provider is on the way'
      : body.status === 'arrived'
        ? 'Provider has arrived'
        : 'Service started';
    runWorkflow({
      event: 'service_status_changed',
      payload: { booking_id: booking.id, status: body.status, title },
      userId: booking.customer_user_id,
      runId: booking.agent_run_id ?? undefined,
    }).catch((e) => console.error('[update-status] service_status push failed:', e));
  }

  return Response.json({ ok: true, status: body.status });
}
