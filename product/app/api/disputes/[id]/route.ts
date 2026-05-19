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
  acknowledged: z.boolean(),
  statement: z.string().min(5).max(2000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return new Response('invalid_request', { status: 400 }); }

  // Verify the user is the provider tied to this dispute.
  const { data: dispute, error } = await admin
    .from('disputes')
    .select('id, status, booking_id, bookings(provider_id, providers(owner_user_id))')
    .eq('id', id)
    .single();
  if (error || !dispute) return new Response('dispute_not_found', { status: 404 });

  const bookingRel = Array.isArray(dispute.bookings) ? (dispute.bookings[0] ?? null) : (dispute.bookings as { providers: unknown } | null);
  const providerRel = bookingRel ? (Array.isArray(bookingRel.providers) ? (bookingRel.providers[0] ?? null) : bookingRel.providers) : null;
  const ownerId = (providerRel as { owner_user_id?: string } | null)?.owner_user_id;
  if (ownerId !== user.id) return new Response('forbidden', { status: 403 });

  if (dispute.status !== 'open' && dispute.status !== 'under_review') {
    return new Response('not_responsive', { status: 400 });
  }

  const runId = randomUUID();
  const logger = createLogger(runId);
  const ctx: AgentContext = {
    runId,
    userId: user.id,
    logger,
    emitTrace: async (s) => persistTrace(s),
    callTool: (name, args) => callTool(name, args, { runId, userId: user.id, logger }),
  };

  const out = await runDisputes({
    mode: 'respond',
    dispute_id: id,
    statement: body.statement,
    attachments: body.attachments,
    provider_acknowledged: body.acknowledged,
  }, ctx, nextStepIndex(runId));

  return Response.json({ ok: true, status: out.status, resolution: out.resolution });
}
