import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return new Response('invalid', { status: 400 }); }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: body.endpoint, keys: body.keys },
    { onConflict: 'endpoint' },
  );
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
