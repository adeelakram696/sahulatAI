# 05 — Antigravity Setup

Client initialization, tool/agent/workflow registration pattern, trace mirroring to Supabase.

[← back to README](./README.md) · scope: [agent-workflow.md](../scope/agent-workflow.md)

> **Phase-0 smoke test**: before any of this, the agent lead must read the latest Antigravity docs and write a 5-line "hello tool, hello agent" example. Confirm the SDK shape and naming. If anything below doesn't match the real SDK, **the SDK wins** — update the wrappers, don't fight it.

---

## 1. Client

`lib/antigravity/client.ts` — single source for the Antigravity SDK handle.

```ts
// PSEUDOCODE — adjust to actual SDK names verified in Phase 0 smoke test
import { Antigravity } from '@google/antigravity';

export const ag = new Antigravity({
  apiKey: process.env.ANTIGRAVITY_API_KEY!,
  projectId: process.env.ANTIGRAVITY_PROJECT_ID!,
  defaultModel: 'gemini-2.x-flash', // overridden per-agent
});
```

If the SDK doesn't expose the methods we need (workflows, traces), we wrap a thin façade in `lib/antigravity/runtime.ts` that emits the same interface and back-fills via direct Gemini calls — agents and tools should never care.

---

## 2. Tool registration pattern

Every tool is one file in `lib/antigravity/tools/`. Pattern:

```ts
// lib/antigravity/tools/_tool.ts (shared)
import { z } from 'zod';
export interface Tool<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  description: string;
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>>;
}
export interface ToolContext { runId: string; userId?: string; logger: Logger; }
```

Example tool file:

```ts
// lib/antigravity/tools/distance-matrix.ts
import { z } from 'zod';
import type { Tool } from './_tool';

const Input = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destinations: z.array(z.object({ lat: z.number(), lng: z.number() })).max(25),
});
const Output = z.object({
  distances: z.array(z.object({ meters: z.number(), seconds: z.number() })),
});

export const distanceMatrix: Tool<typeof Input, typeof Output> = {
  name: 'google.distance_matrix',
  description: 'Distance + ETA from one origin to N destinations.',
  input: Input,
  output: Output,
  async run({ origin, destinations }, ctx) {
    ctx.logger.tool('google.distance_matrix.start', { origin, destinations });
    // real Google call OR Haversine fallback if NEXT_PUBLIC_USE_GOOGLE_APIS=false
    return { distances: [] };
  },
};
```

Register all tools in `lib/antigravity/tools/index.ts`:
```ts
export const ALL_TOOLS = [distanceMatrix, placesNearby, /* ... */];
```

---

## 3. Agent registration pattern

Each agent is a file in `lib/antigravity/agents/`. Pattern:

```ts
// lib/antigravity/agents/_agent.ts
import { z } from 'zod';
export interface Agent<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: AgentName;
  model: string;
  systemPrompt: string;
  tools: string[];        // tool names this agent may call
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: AgentContext) => Promise<z.infer<O>>;
}
export type AgentName = 'planner' | 'intent_parser' | 'discovery' | 'ranking' | 'booking' | 'followup';
export interface AgentContext { runId: string; userId?: string; emitTrace: (step: TraceStep) => Promise<void>; callTool: <T>(name: string, args: any) => Promise<T>; }
```

The agent's `run` either (a) calls Antigravity's LLM with the bound tools and lets the SDK orchestrate tool calls, OR (b) drives the LLM/tool calls manually if the SDK is too opinionated. Either way, `emitTrace` is called for every step so our UI gets data.

---

## 4. Workflow runtime

`lib/antigravity/runtime.ts` — the entry point called by `/api/agent/run`.

Responsibilities:
1. Receive event (`new_request`, `slot_selected`, etc.).
2. Invoke **Planner** to get a plan.
3. For each `AgentCall` in the plan, run the agent with its inputs (chaining outputs).
4. Stream every `emitTrace` to the API route via an in-process EventEmitter.
5. Persist every trace step to `agent_traces` via the service-role client.

```ts
// lib/antigravity/runtime.ts (sketch)
export async function runWorkflow(event: AppEvent, payload: any, runId = randomUUID()) {
  const plan = await PlannerAgent.run({ event, payload, run_id: runId });
  for (const call of plan.plan) {
    const agent = AGENT_MAP[call.agent];
    const output = await agent.run(call.input, { runId, userId: payload.userId, emitTrace, callTool });
    yield { agent: call.agent, output };
  }
}
```

---

## 5. Trace mirroring

Two writers, same row:
- **Source of truth:** Antigravity's own trace (if SDK exposes one).
- **Our UI:** every `emitTrace` call upserts a row in `agent_traces`. UI streams via Supabase Realtime channel `agent_traces:run_id=<uuid>`.

Service-role insert (not via anon client):

```ts
// lib/antigravity/trace.ts
import { admin } from '@/lib/supabase/admin';

export async function emitTrace(step: TraceStep) {
  await admin.from('agent_traces').insert({
    run_id: step.runId,
    parent_step_id: step.parentStepId ?? null,
    agent_name: step.agentName,
    step_index: step.stepIndex,
    started_at: step.startedAt,
    ended_at: step.endedAt,
    inputs: step.inputs,
    outputs: step.outputs,
    tool_calls: step.toolCalls,
    reasoning: step.reasoning,
    status: step.status,
    error: step.error,
  });
}
```

---

## 6. LLM access — Antigravity native (decision locked)

We go directly through Antigravity's LLM interface (Gemini under the hood). No Vercel AI Gateway, no Langfuse. Rationale: Antigravity is the mandated platform; using it directly maximizes the "use of Antigravity" rubric weight and reduces an entire hop.

```ts
// lib/antigravity/llm.ts
import { ag } from './client';

export async function generateStructured<T extends z.ZodTypeAny>(args: {
  model?: string;            // optional override; default Gemini Flash for fast paths
  system: string;
  messages: ChatMessage[];
  schema: T;
  runId: string;
}): Promise<z.infer<T>> {
  return await ag.generate({
    model: args.model ?? 'gemini-2.x-flash',
    systemInstruction: args.system,
    messages: args.messages,
    responseSchema: args.schema,
    runId: args.runId,
  });
}
```

**Observability:** rely on (a) Antigravity's native trace + (b) our `agent_traces` mirror. We do *not* need a third LLM tracing layer for hackathon scope.

**Fallback only if Antigravity SDK is missing features** (per Phase-0 smoke test): direct `@google/generative-ai` SDK call inside the same `llm.ts` — agents stay unaware of the swap.

```ts
// Inside llm.ts when AG_LLM_AVAILABLE === false:
import { GoogleGenerativeAI } from '@google/generative-ai';
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
// generateContent + zodResponseFormat-equivalent JSON parse
```

This path requires only `GOOGLE_GEMINI_API_KEY` (Gemini direct), not the Antigravity key — useful for local dev too.

---

## 7. Streaming + SSE

`/api/agent/run` returns SSE. The runtime emits events to a per-run `EventEmitter`; the route handler reads from it and writes SSE chunks.

```ts
// app/api/agent/run/route.ts (sketch)
const stream = new ReadableStream({
  async start(controller) {
    for await (const event of runWorkflow(...)) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    }
    controller.close();
  },
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

---

## Acceptance for 05-antigravity-setup

- [ ] Phase-0 smoke test passes (one agent, one tool, returns successfully).
- [ ] `lib/antigravity/client.ts` exports a single `ag` handle.
- [ ] Tool + Agent base interfaces compile.
- [ ] `emitTrace` writes a row visible in `agent_traces`.
- [ ] SSE stream from `/api/agent/run` delivers a single mock trace event end-to-end.
- [ ] `generateStructured` returns a typed object via Antigravity LLM (or direct Gemini fallback if SDK gap discovered in smoke test).
