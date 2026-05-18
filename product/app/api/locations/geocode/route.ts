import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { geocodeTool } from '@/lib/antigravity/tools/google';

const Body = z.object({
  text: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return Response.json({ error: 'invalid body' }, { status: 400 }); }

  if (!body.text && (body.lat === undefined || body.lng === undefined)) {
    return Response.json({ error: 'text or (lat,lng) required' }, { status: 400 });
  }

  try {
    const result = await geocodeTool.run(
      {
        text: body.text,
        coords: body.lat !== undefined && body.lng !== undefined ? { lat: body.lat, lng: body.lng } : undefined,
      },
      {
        runId: 'geocode',
        userId: user.id,
        logger: { tool: () => {}, warn: (m, d) => console.warn('[geocode]', m, d) },
      },
    );
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
