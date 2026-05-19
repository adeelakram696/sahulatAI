import { type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { runConversation, type ChatMessage } from '@/lib/antigravity/agents/conversation';
import { createLogger, persistTrace } from '@/lib/antigravity/trace';
import { callTool } from '@/lib/antigravity/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
  // Optional artifacts on model turns so previous search results survive page reloads
  // and re-feed into the next agent run (candidate map + system prompt).
  artifacts: z.array(z.record(z.unknown())).optional(),
});

const Body = z.object({
  messages: z.array(MessageSchema).min(1),
  selected_location_id: z.string().uuid(),
  locale: z.enum(['en', 'ur', 'ur-Latn']).default('en'),
  run_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    return new Response(JSON.stringify({ error: { code: 'invalid_body', issues: (e as z.ZodError).issues } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve user location with lat/lng via the RPC (avoids opaque PostGIS hex).
  const { data: rows, error: locErr } = await supabase.rpc('get_user_location_geo', {
    p_id: body.selected_location_id,
  });
  if (locErr) return new Response(`location lookup error: ${locErr.message}`, { status: 500 });
  const loc = rows?.[0];
  if (!loc || loc.user_id !== user.id) return new Response('location not owned by user', { status: 403 });

  const runId = body.run_id ?? randomUUID();
  const logger = createLogger(runId);
  const ctx = {
    runId,
    userId: user.id,
    logger,
    emitTrace: async (step: Parameters<typeof persistTrace>[0]) => { await persistTrace(step); },
    callTool: <T = unknown>(name: string, args: unknown): Promise<T> =>
      callTool<T>(name, args, { runId, userId: user.id, logger }),
  };

  const conversationInput = {
    messages: body.messages as ChatMessage[],
    user_id: user.id,
    user_location: {
      id: loc.id,
      address_text: loc.address_text,
      city: loc.city,
      town_or_area: loc.town_or_area,
      point: { lat: loc.lat, lng: loc.lng },
    },
    locale: body.locale,
  };

  try {
    const result = await runConversation(conversationInput, ctx);
    return Response.json({ runId, ...result });
  } catch (e) {
    return Response.json({ runId, error: (e as Error).message }, { status: 500 });
  }
}
