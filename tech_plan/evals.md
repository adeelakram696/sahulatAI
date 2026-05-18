# Evals — Final Verification Rubric

The implementation is **complete** when every check in this doc passes. This is the master rollup.

[← back to README](./README.md)

> Two layers:
> - **Brief evals** — directly tied to the hackathon brief's wording. Missing any of these = at risk of failing the challenge.
> - **Rubric evals** — tied to the 6 scoring buckets. Each must score competitively.
>
> Every check links to the implementation source-of-truth so reviewers can verify quickly.

---

## Layer 1 — Brief evals (mandatory)

### 1. Intent understanding

| # | Check | Source | Verified by |
|---|---|---|---|
| 1.1 | Accepts free-form input in English | [07-agents § Intent](./07-agents.md#2-libantigravityagentsintent-parserts) | Live demo + unit fixture `en-*.json` |
| 1.2 | Accepts free-form input in Urdu (`اردو` script) | same | Live demo + unit fixture `ur-*.json` |
| 1.3 | Accepts free-form input in Roman Urdu | same | Canonical query in demo + unit fixture `ur-Latn-*.json` |
| 1.4 | Extracts service type | same (`service_slug` output) | Trace JSON inspection |
| 1.5 | Extracts location | same (`location.point`) | Trace JSON inspection |
| 1.6 | Extracts time | same (`time.iso`) | Trace JSON inspection |
| 1.7 | Asks clarification when ambiguous | spec `needs_clarification` path | Unit test forcing low confidence |

### 2. Provider discovery

| # | Check | Source | Verified by |
|---|---|---|---|
| 2.1 | Uses mock dataset (DB) | [02-database § seed](./02-database.md#3-seed-data-supabaseseedsql) | Seeded providers visible in `/demo` |
| 2.2 | Uses Google Places / Maps APIs | [06-tools § Google](./06-tools.md#2-google-tools) | Trace JSON shows `google.places_nearby` calls |
| 2.3 | Identifies nearby providers | [07-agents § Discovery](./07-agents.md#3-libantigravityagentsdiscoveryts) | Map preview shows ≥1 pin near user location |
| 2.4 | Matches service category | same | Trace JSON shows category filter |

### 3. Matching & ranking

| # | Check | Source | Verified by |
|---|---|---|---|
| 3.1 | Ranks by distance | [07-agents § Ranking](./07-agents.md#4-libantigravityagentsrankingts) | Trace shows Distance Matrix call + score |
| 3.2 | Ranks by availability | same | Trace shows `supabase.check_availability` |
| 3.3 | Ranks by rating | same | Score breakdown in trace |
| 3.4 | Provides reasoning for selection | spec `llm.explain_bilingual` | "Why?" expand in UI shows EN+UR |

### 4. Decision & recommendation

| # | Check | Source |
|---|---|---|
| 4.1 | Recommends best provider OR top options | Top 3 cards in UI |
| 4.2 | Explains decision in simple terms | Reasoning text per card |

### 5. Action simulation (CRITICAL)

| # | Check | Source |
|---|---|---|
| 5.1 | Booking confirmation message generated | [07-agents § Booking artifacts](./07-agents.md#5-libantigravityagentsbookingts), `llm.confirmation_message` |
| 5.2 | Provider assignment persisted | `bookings.provider_id` populated in DB |
| 5.3 | Scheduling persisted | `bookings.slot_start/end` populated |
| 5.4 | Booking receipt generated | `generate_receipt` produces a PDF URL |
| 5.5 | DB write occurs (state change) | `bookings` row visible in Supabase UI |
| 5.6 | End-to-end booking demonstrated | E2E test [13-testing § integration](./13-testing.md#4-integration-test-testsintegrationagent-flowtestts) |

### 6. Follow-up automation

| # | Check | Source |
|---|---|---|
| 6.1 | Reminder simulated | `reminders` row created on `booking_confirmed`; pg_cron drains it |
| 6.2 | Status update simulated | `bookings.status` transitions `→ reminded → in_progress → completed` |
| 6.3 | Completion confirmation simulated | Auto-transition in Follow-up `check_completion` mode |

### 7. Agentic workflow (MANDATORY)

| # | Check | Source |
|---|---|---|
| 7.1 | Multiple agents OR structured pipeline | 6 agents in [07-agents](./07-agents.md) |
| 7.2 | Planning → decision → action → follow-up | Plan emitted by Planner; trace shows ordering |
| 7.3 | Traceable logs of decisions | `agent_traces.reasoning` populated for every step |
| 7.4 | Traceable logs of tool usage | `agent_traces.tool_calls` jsonb |
| 7.5 | Traceable logs of action execution | `agent_traces.outputs` jsonb |

### 8. Deliverables

| # | Check | Source |
|---|---|---|
| 8.1 | Working prototype with mobile app (MUST) | PWA installable on Android Chrome (verified [04-pwa-and-push § Acceptance](./04-pwa-and-push.md#acceptance-for-04-pwa-and-push)) |
| 8.2 | Web app (Optional) | Same PWA on desktop |
| 8.3 | Demo video 3–5 min | [scope/demo-script.md](../scope/demo-script.md) + [15-demo-prep](./15-demo-prep.md) |
| 8.4 | Agent trace / logs | `/trace/[runId]` UI + `GET /api/agent/trace?format=json` |
| 8.5 | README — architecture | [14-deploy § README](./14-deploy.md#3-readme-structure-readmemd-at-repo-root) |
| 8.6 | README — Antigravity usage | same |
| 8.7 | README — APIs/tools used | same |
| 8.8 | README — assumptions + limitations | same |

### 9. Other guidelines

| # | Check |
|---|---|
| 9.1 | Not a simple listing app — agent-led flow visible in trace |
| 9.2 | At least one booking simulated end-to-end (5.6) |
| 9.3 | Demonstrates reasoning + decision-making (3.4, 7.3) |
| 9.4 | Uses mock data if real APIs unavailable — `NEXT_PUBLIC_USE_GOOGLE_APIS=false` works; `notify_provider` mock chain works |
| 9.5 | No real PII — verified in seed data ([02-database § seed](./02-database.md#3-seed-data-supabaseseedsql)) |

---

## Layer 2 — Rubric evals (scoring)

### Antigravity orchestration (25%)

| # | Check | Target |
|---|---|---|
| AG-1 | All 6 agents registered in Antigravity | Trace shows agent invocations |
| AG-2 | All 22 tools registered in Antigravity | Tool registry table in trace + [06-tools § registry](./06-tools.md#6-the-all-tools-registry) |
| AG-3 | Antigravity drives workflow chaining | [05-antigravity-setup § Workflow runtime](./05-antigravity-setup.md#4-workflow-runtime) |
| AG-4 | Antigravity tracing exported | Trace JSON contains Antigravity-side step ids if SDK provides them |
| AG-5 | Visible in demo video | [scope/demo-script.md § 0:35–1:30](../scope/demo-script.md) |

### Agentic reasoning (20%)

| # | Check |
|---|---|
| AR-1 | Planner exists and emits explicit plan | Trace step `planner` with `plan` array |
| AR-2 | Multi-step reasoning across events | `run_id` joins 3–4 logical runs |
| AR-3 | Reasoning text persisted per step | `agent_traces.reasoning` populated everywhere |
| AR-4 | Bilingual reasoning on top picks | UI "Why?" shows EN + UR |
| AR-5 | Autonomy proven | Follow-up fires without user input |

### Matching quality (20%)

| # | Check |
|---|---|
| MQ-1 | 5-factor composite score implemented | TS function in `ranking.ts` |
| MQ-2 | Distance via Distance Matrix | trace shows `google.distance_matrix` |
| MQ-3 | Availability check enforced | `supabase.check_availability` + exclusion constraint |
| MQ-4 | Low-confidence fallback shown | `low_confidence: true` UI state |
| MQ-5 | Dedup logic visible in trace | `sources_breakdown` in Discovery output |

### Action simulation (15%)

| # | Check |
|---|---|
| AS-1 | Real DB state transitions | `bookings.status` enum transitions verified |
| AS-2 | PDF receipt | downloadable from booking page |
| AS-3 | Calendar artifacts | `.ics` + Google Calendar deep link work |
| AS-4 | Provider notification with fallback | trace shows `invitation_channel`; mock path writes row |
| AS-5 | pg_cron reminder fires | manual + automated test |
| AS-6 | Mock-mode UI card visible when channel=mock | demo backup story holds |

### Technical implementation (10%)

| # | Check |
|---|---|
| TI-1 | Next.js 16 App Router + TS strict | `pnpm typecheck` passes |
| TI-2 | Supabase: 9 tables + RLS + pg_cron + PostGIS | extensions enabled |
| TI-3 | 4 Google APIs wired | each tool tested |
| TI-4 | Vercel deploy succeeds | prod URL 200 |
| TI-5 | Free-tier everything (no surprise bills) | dashboards checked post-demo |
| TI-6 | Clean repo structure | tree matches [01-bootstrap § folder layout](./01-bootstrap.md#3-folder-layout) |
| TI-7 | Tests green | `pnpm test` passes |

### Innovation & UX (10%)

| # | Check |
|---|---|
| IUX-1 | Multilingual chat with RTL | Urdu locale flips direction |
| IUX-2 | Multi-location profile | onboarding requires ≥1; chat picker switches |
| IUX-3 | Live trace UI | drawer streams; export JSON; replay |
| IUX-4 | Login-free provider acceptance | acceptance page works with token alone |
| IUX-5 | Mock-mode visible as feature | demo card surfaces the message body |
| IUX-6 | Confetti + summary card matching brief format | confirmed receipt screen |
| IUX-7 | PWA installable on mobile + desktop | Lighthouse PWA pass |
| IUX-8 | < 8 s perceived latency for agent run | progress card streams |

---

## How to run the evals before submission

1. **Layer 1 — Brief evals**: walk through Section 1–9 above, ticking each box. Any miss = blocker.
2. **Layer 2 — Rubric evals**: walk through Sections AG / AR / MQ / AS / TI / IUX. Aim for full ticks.
3. **Manual QA**: run [13-testing § Manual QA checklist](./13-testing.md#7-manual-qa-checklist-run-before-demo-recording) on production.
4. **Smoke test**: run [14-deploy § Smoke test](./14-deploy.md#2-smoke-test-run-on-prod).
5. **Demo prep**: run [15-demo-prep § Dry-run script](./15-demo-prep.md#4-dry-run-script-run-30-min-before-recording).

If any check fails, the corresponding file in this tech_plan tells you exactly which task to revisit.
