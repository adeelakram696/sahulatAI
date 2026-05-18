# 11 — Trace Viewer & Demo Dashboard

Live drawer, full inspector page, replay, demo dashboard.

[← back to README](./README.md) · scope: [ui-screens.md § Trace / demo screens](../scope/ui-screens.md#trace--demo-screens)

---

## 1. Trace step component (`components/trace-drawer/trace-step.tsx`)

Props:
```ts
{ step: AgentTraceRow, depth: number, isSelected: boolean, onClick: () => void }
```

Visual:
- Icon (one per agent name) · agent name · status dot (running/done/error) · duration ms · expand chevron.
- Expanded: collapsible JSON of inputs / outputs / tool_calls / reasoning.

---

## 2. Live drawer (`components/trace-drawer/drawer.tsx`)

Slide-out from the right on desktop; full-screen sheet on mobile (shadcn `Sheet` with `side="right"`).

### Data source
Two inputs combined:
1. **SSE stream** from `/api/agent/run` — events as they happen during a live run.
2. **Supabase Realtime** subscription on `agent_traces` filtered by current `run_id` — for catch-up + after the SSE stream closes.

```ts
// lib/hooks/use-trace.ts
export function useTrace(runId: string | null) {
  const [steps, setSteps] = useState<AgentTraceRow[]>([]);
  // initial load from /api/agent/trace?runId=...
  // then subscribe to realtime channel
}
```

### UI groupings
- Group steps by **run** (one booking can span 3–4 runs, all with the same composite booking id). Show collapsible headers per run.
- Color steps by status: emerald (ok), amber (running), rose (error), slate (needs_input).

### Export
- Footer: `<Button>Export JSON</Button>` downloads the entire `run_id`'s trace from `/api/agent/trace?...&format=json`.
- `<Button>Open full trace</Button>` → routes to `/trace/[runId]`.

---

## 3. Full inspector (`app/(trace)/trace/[runId]/page.tsx`)

Server component fetches all trace rows, passes to a client `<TraceInspector>`.

Layout:
- 2-column on desktop, tabs on mobile.
- Left: timeline tree (parent → child tool calls). Vertical rail.
- Right: selected step details — full JSON, reasoning text, related events.
- Top bar: replay button, export, copy run id, share link.

### Replay
- `<Button>Replay</Button>` → calls a special route `POST /api/agent/replay?runId=...` which **re-runs the workflow** with the same inputs from the original `new_request` event, persisting under a new `run_id`. Old run remains unchanged.
- After kickoff: navigate to the new run's trace; user sees the agents re-run live.

---

## 4. Demo dashboard (`app/(trace)/demo/page.tsx`)

Visible when `?demo=1` or via footer toggle (which sets a cookie).

Sections:
- **Try a sample**: 4 prefilled query cards. Each card has language tag (English / Urdu / Roman Urdu / edge case). Tap → fills `/chat` with the query and selected location.
- **Recent runs**: last 5 runs (own + seeded) with links to traces.
- **Open as provider**: shortcut to a seeded provider's dashboard (signs you in as a demo provider account).
- **Architecture diagram**: a static SVG inlined for judges who scroll.

---

## 5. Streaming trace event types

```ts
type TraceEvent =
  | { kind: 'step_started', step: Partial<AgentTraceRow> }
  | { kind: 'step_progress', step_id: string, partial_output: any }
  | { kind: 'step_finished', step: AgentTraceRow }
  | { kind: 'run_complete', run_id: string, result: any };
```

The runtime emits these to the SSE stream and writes corresponding rows to `agent_traces`.

---

## Acceptance for 11-trace-viewer

- [ ] Drawer opens on chat surface and shows steps streaming live during a canonical run.
- [ ] Steps grouped by run; statuses color-coded; expand reveals JSON.
- [ ] `/trace/[runId]` loads a seeded historical run end-to-end.
- [ ] Replay re-runs the workflow under a new `run_id` and lands the user on it.
- [ ] Export JSON downloads valid JSON with all steps.
- [ ] Demo dashboard prefilled queries work in one click.
