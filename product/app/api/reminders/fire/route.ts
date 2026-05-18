import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { runWorkflow } from '@/lib/antigravity/runtime';

const Body = z.object({
  reminder_id: z.string().uuid(),
  booking_id: z.string().uuid(),
  kind: z.enum(['pre_appointment', 'completion_check', 'rating_prompt']),
});

const KIND_TO_EVENT = {
  pre_appointment: 'reminder_due',
  completion_check: 'completion_check_due',
  rating_prompt: 'rating_prompt_due',
} as const;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!env.REMINDERS_FIRE_SECRET || auth !== `Bearer ${env.REMINDERS_FIRE_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return new Response('invalid body', { status: 400 }); }

  // Skip already-sent
  const { data: rem } = await admin
    .from('reminders').select('status').eq('id', body.reminder_id).single();
  if (!rem || rem.status === 'sent') return new Response('ok', { status: 200 });

  try {
    await runWorkflow({
      event: KIND_TO_EVENT[body.kind],
      payload: { booking_id: body.booking_id, reminder_kind: body.kind },
    });
    await admin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', body.reminder_id);
    return new Response('ok', { status: 200 });
  } catch (e) {
    await admin.from('reminders').update({ status: 'failed' }).eq('id', body.reminder_id);
    return new Response((e as Error).message, { status: 500 });
  }
}
