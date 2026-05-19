import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';

const Body = z.object({
  checklist: z.record(z.boolean()),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { id } = await params;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) { return Response.json({ error: (e as z.ZodError).message }, { status: 400 }); }

  // Only the provider who owns the booking can update the checklist.
  const { data: booking } = await admin
    .from('bookings')
    .select('id, provider_id, providers!inner(owner_user_id)')
    .eq('id', id)
    .maybeSingle();

  if (!booking) return Response.json({ error: 'booking not found' }, { status: 404 });
  const ownerUserId = (booking.providers as unknown as { owner_user_id: string } | null)?.owner_user_id;
  if (ownerUserId !== user.id) return new Response('forbidden', { status: 403 });

  const { error } = await admin
    .from('bookings')
    .update({ service_checklist: body.checklist })
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
