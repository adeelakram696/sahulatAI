import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { runDisputes } from '@/lib/antigravity/agents/disputes';
import { createLogger, nextStepIndex, persistTrace } from '@/lib/antigravity/trace';
import { callTool } from '@/lib/antigravity/tools';
import type { AgentContext } from '@/lib/antigravity/types';

const Body = z.object({
  booking_id: z.string().uuid(),
  kind: z.enum(['no_show', 'quality', 'price', 'cancellation', 'overrun', 'damage']),
  statement: z.string().min(5).max(2000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return new Response('invalid_request', { status: 400 }); }

  // Verify the booking belongs to this customer and is in a state that allows a dispute.
  const { data: booking, error } = await admin
    .from('bookings')
    .select('id, customer_user_id, provider_id, status, slot_start')
    .eq('id', body.booking_id)
    .single();
  if (error || !booking) return new Response('booking_not_found', { status: 404 });
  if (booking.customer_user_id !== user.id) return new Response('forbidden', { status: 403 });

  // A dispute is only valid once the job has actually happened: either the
  // booking reached a terminal state, or its slot time is already in the past
  // (covers no-shows on a still-"confirmed" booking).
  const terminalStatuses = ['completed', 'cancelled', 'rejected'];
  const inProgressStatuses = ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'];
  const slotInPast = new Date(booking.slot_start).getTime() < Date.now();
  const disputable = terminalStatuses.includes(booking.status)
    || (slotInPast && inProgressStatuses.includes(booking.status));
  if (!disputable) {
    return new Response('not_disputable', { status: 400 });
  }

  // One dispute per booking — block duplicates.
  const { data: existingDispute } = await admin
    .from('disputes')
    .select('id')
    .eq('booking_id', body.booking_id)
    .maybeSingle();
  if (existingDispute) {
    return Response.json({ error: 'already_disputed', dispute_id: existingDispute.id }, { status: 409 });
  }

  // Create the dispute row first
  const { data: created, error: insErr } = await admin
    .from('disputes')
    .insert({
      booking_id: body.booking_id,
      opened_by: user.id,
      opener_role: 'customer',
      kind: body.kind,
      status: 'open',
      statements: [{
        role: 'customer',
        message: body.statement,
        attachments: body.attachments ?? [],
        at: new Date().toISOString(),
      }],
    })
    .select('id')
    .single();
  if (insErr || !created) return new Response(insErr?.message ?? 'insert_failed', { status: 500 });

  // Trigger the dispute agent intake (best-effort)
  const runId = randomUUID();
  const logger = createLogger(runId);
  const ctx: AgentContext = {
    runId,
    userId: user.id,
    logger,
    emitTrace: async (s) => persistTrace(s),
    callTool: (name, args) => callTool(name, args, { runId, userId: user.id, logger }),
  };
  runDisputes({ mode: 'intake', dispute_id: created.id, statement: body.statement, attachments: body.attachments }, ctx, nextStepIndex(runId))
    .catch((e) => console.error('[disputes] intake failed:', e));

  return Response.json({ ok: true, dispute_id: created.id });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  // Optional ?role=provider lists provider-side disputes; default: customer-side.
  const role = req.nextUrl.searchParams.get('role') === 'provider' ? 'provider' : 'customer';

  if (role === 'customer') {
    const { data, error } = await admin
      .from('disputes')
      .select('id, booking_id, kind, status, opened_at, resolution, statements, bookings!inner(customer_user_id, providers(business_name))')
      .eq('bookings.customer_user_id', user.id)
      .order('opened_at', { ascending: false });
    if (error) return new Response(error.message, { status: 500 });
    return Response.json({ disputes: data ?? [] });
  }

  // provider side
  const { data, error } = await admin
    .from('disputes')
    .select('id, booking_id, kind, status, opened_at, resolution, statements, bookings!inner(provider_id, customer_name_snapshot, providers!inner(owner_user_id, business_name))')
    .eq('bookings.providers.owner_user_id', user.id)
    .order('opened_at', { ascending: false });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ disputes: data ?? [] });
}
