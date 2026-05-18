import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) return new Response('runId required', { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('agent_traces')
    .select('*')
    .eq('run_id', runId)
    .order('step_index', { ascending: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ runId, steps: data });
}
