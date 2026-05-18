import { admin } from '@/lib/supabase/admin';
import type { TraceStep } from './types';

let stepCounter = 0;
const counterByRun = new Map<string, number>();

export function nextStepIndex(runId: string): number {
  const cur = counterByRun.get(runId) ?? 0;
  counterByRun.set(runId, cur + 1);
  return cur;
}

export async function persistTrace(step: TraceStep): Promise<void> {
  try {
    await admin.from('agent_traces').insert({
      run_id: step.runId,
      parent_step_id: step.parentStepId ?? null,
      agent_name: step.agentName,
      step_index: step.stepIndex,
      started_at: step.startedAt,
      ended_at: step.endedAt ?? null,
      inputs: step.inputs ?? null,
      outputs: step.outputs ?? null,
      tool_calls: step.toolCalls ?? null,
      reasoning: step.reasoning ?? null,
      status: step.status,
      error: step.error ?? null,
    });
  } catch (e) {
    console.warn('[trace] persist failed:', e);
  }
}

export function createLogger(_runId: string) {
  return {
    tool: (name: string, payload?: unknown) => console.log(`[tool] ${name}`, payload),
    warn: (msg: string, data?: unknown) => console.warn(`[warn] ${msg}`, data),
  };
}
