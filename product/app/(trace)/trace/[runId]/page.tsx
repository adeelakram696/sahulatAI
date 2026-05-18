import { createClient } from '@/lib/supabase/server';

interface TraceRow {
  step_index: number;
  agent_name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  reasoning: string | null;
  inputs: unknown;
  outputs: unknown;
}

export default async function TracePage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data: traces } = await supabase
    .from('agent_traces')
    .select('step_index, agent_name, status, started_at, ended_at, reasoning, inputs, outputs')
    .eq('run_id', runId)
    .order('step_index', { ascending: true });

  return (
    <main className="container max-w-3xl py-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground">Trace</p>
          <h1 className="text-xl font-bold font-mono">{runId}</h1>
        </div>
        <a href={`/api/agent/trace?runId=${runId}`} download={`trace-${runId}.json`}
          className="text-sm rounded-md border border-border px-3 py-1.5">
          Export JSON
        </a>
      </header>
      <ol className="space-y-3">
        {(traces ?? []).map((t: TraceRow) => (
          <li key={t.step_index} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold">#{t.step_index} · {t.agent_name}</span>
              <span className={t.status === 'ok' ? 'text-emerald-600' : t.status === 'error' ? 'text-rose-600' : 'text-amber-600'}>
                {t.status}
              </span>
            </div>
            {t.reasoning && <p className="text-sm">{t.reasoning}</p>}
            {t.outputs ? (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">outputs</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(t.outputs, null, 2)}</pre>
              </details>
            ) : null}
          </li>
        ))}
        {(!traces || traces.length === 0) && <p className="text-sm text-muted-foreground">No trace found.</p>}
      </ol>
    </main>
  );
}
