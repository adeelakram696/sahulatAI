import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  label: z.string().min(1).max(64),
  address_text: z.string().min(1).max(256),
  lat: z.number(),
  lng: z.number(),
  city: z.string().nullable().optional(),
  town_or_area: z.string().nullable().optional(),
  country_code: z.string().default('PK'),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) { return Response.json({ error: { message: 'invalid body', issues: (e as z.ZodError).issues } }, { status: 400 }); }

  const { data, error } = await supabase
    .from('user_locations')
    .insert({
      user_id: user.id,
      label: body.label,
      address_text: body.address_text,
      point: `SRID=4326;POINT(${body.lng} ${body.lat})`,
      city: body.city ?? null,
      town_or_area: body.town_or_area ?? null,
      country_code: body.country_code,
      last_used_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: { message: error.message } }, { status: 500 });

  // If this is the first location, set as default
  const { count } = await supabase.from('user_locations').select('id', { head: true, count: 'exact' }).eq('user_id', user.id);
  if (count === 1) {
    await supabase.from('users_profile').update({ default_location_id: data!.id }).eq('user_id', user.id);
  }

  return Response.json({ id: data!.id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('user_locations')
    .select('id, label, address_text, city, town_or_area, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ locations: data });
}
