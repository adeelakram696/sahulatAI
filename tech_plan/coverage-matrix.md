# Coverage Matrix — Scope ↔ Tech Plan

Proves every scope item has a home in the implementation plan. If you change scope, update this matrix.

[← back to README](./README.md)

---

## A. Brief requirements

| Brief requirement | Tech plan file |
|---|---|
| Natural-language input (Urdu, Roman Urdu, English) | [07-agents](./07-agents.md#2-libantigravityagentsintent-parserts), [13-testing § fixtures](./13-testing.md#per-agent-fixtures-testsfixturesintents) |
| Identify nearby providers using location | [07-agents § Discovery](./07-agents.md#3-libantigravityagentsdiscoveryts), [06-tools § Google + Supabase](./06-tools.md#2-google-tools) |
| Select / recommend best provider with reasoning | [07-agents § Ranking](./07-agents.md#4-libantigravityagentsrankingts) |
| Simulate booking + confirmation | [07-agents § Booking](./07-agents.md#5-libantigravityagentsbookingts), [09-customer-ui § Invitation/Confirmation](./09-customer-ui.md#5-invitation-pending--confirmed-flip-appcustomerbookingidpagetsx) |
| Handle follow-up | [07-agents § Follow-up](./07-agents.md#6-libantigravityagentsfollowupts), [12-reminders-and-notify](./12-reminders-and-notify.md) |
| Show complete reasoning + workflow execution | [11-trace-viewer](./11-trace-viewer.md) |
| **Google Antigravity as core platform** | [05-antigravity-setup](./05-antigravity-setup.md), all of [06-tools](./06-tools.md) + [07-agents](./07-agents.md) |
| At least one booking simulated end-to-end | [09-customer-ui § Acceptance](./09-customer-ui.md#acceptance-for-09-customer-ui), [13-testing § integration](./13-testing.md#4-integration-test-testsintegrationagent-flowtestts) |
| Multi-step reasoning + planning→decision→action→follow-up | [07-agents] (6 agents + Planner), [05-antigravity-setup § Workflow runtime](./05-antigravity-setup.md#4-workflow-runtime) |
| Traceable logs of decisions/tool usage/action execution | [02-database § agent_traces](./02-database.md#0003_bookings_and_tracessql), [11-trace-viewer](./11-trace-viewer.md) |
| Mobile app (MUST) | [04-pwa-and-push](./04-pwa-and-push.md) |
| Web app (Optional) | covered by same PWA |
| Demo video (3–5 min) | [scope/demo-script.md](../scope/demo-script.md), [15-demo-prep](./15-demo-prep.md) |
| Agent trace / logs deliverable | [11-trace-viewer § Export](./11-trace-viewer.md#export), [14-deploy § docs/example-trace.json](./14-deploy.md#acceptance-for-14-deploy) |
| README documentation | [14-deploy § README structure](./14-deploy.md#3-readme-structure-readmemd-at-repo-root) |
| Avoid real personal/sensitive data | [02-database § seed](./02-database.md#3-seed-data-supabaseseedsql), [scope/data-model.md § Privacy](../scope/data-model.md#privacy--test-data) |

---

## B. Customer features (scope/features.md § A)

| Feature ID | Tech plan |
|---|---|
| A0 email/password auth + forgot/change | [03-auth-and-onboarding](./03-auth-and-onboarding.md) |
| A1 customer onboarding (mandatory location) | [03-auth-and-onboarding § 5 wizard](./03-auth-and-onboarding.md#5-location-onboarding-wizard) |
| A2 multi-location management | [03-auth-and-onboarding § 6 manager](./03-auth-and-onboarding.md#6-location-manager-profilelocations) |
| A3 chat input + location picker | [09-customer-ui § Chat](./09-customer-ui.md#2-chat-appcustomerchatpagetsx) |
| A4 multilingual NLU | [07-agents § Intent Parser](./07-agents.md#2-libantigravityagentsintent-parserts) |
| A5 service catalog (8 categories) | [02-database § seed](./02-database.md#3-seed-data-supabaseseedsql) |
| A6 in-process VIEW | [09-customer-ui § In-process VIEW](./09-customer-ui.md#in-process-view-componentschatin-process-viewtsx) |
| A7 recommendation cards (bookable vs contact-only) | [09-customer-ui § Recommendation stack](./09-customer-ui.md#3-recommendation-stack-componentsrecommendations) |
| A8 map preview | [09-customer-ui § Map](./09-customer-ui.md#3-recommendation-stack-componentsrecommendations) |
| A9 booking + invitation simulation | [07-agents § Booking](./07-agents.md#5-libantigravityagentsbookingts), [09-customer-ui § 5](./09-customer-ui.md#5-invitation-pending--confirmed-flip-appcustomerbookingidpagetsx), [12-reminders-and-notify](./12-reminders-and-notify.md) |
| A10 My bookings | [09-customer-ui § 6](./09-customer-ui.md#6-my-bookings-appcustomerbookingspagetsx) |
| A11 follow-up rating prompt | [09-customer-ui § 7](./09-customer-ui.md#7-rating-prompt-componentsratingsrating-sheettsx) |

## C. Business features (scope/features.md § B)

| Feature ID | Tech plan |
|---|---|
| B1 provider signup (email/password) | [10-provider-portal § Auth](./10-provider-portal.md#1-provider-auth) |
| B2 business profile | [10-provider-portal § Onboarding](./10-provider-portal.md#3-onboarding-wizard-appproviderprovideronboarding) |
| B3 service area picker | [10-provider-portal § Service area editor](./10-provider-portal.md#service-area-editor-componentsproviderservice-area-editortsx) |
| B4 availability | [10-provider-portal § Onboarding step 4](./10-provider-portal.md#3-onboarding-wizard-appproviderprovideronboarding) |
| B5 price band | same |
| B6 notification preferences | [10-provider-portal § Onboarding step 5](./10-provider-portal.md#3-onboarding-wizard-appproviderprovideronboarding) |
| B7 booking invitations inbox + accept/reject | [10-provider-portal § Dashboard](./10-provider-portal.md#4-provider-dashboard-appproviderproviderdashboardpagetsx) |
| B8 login-free provider acceptance page | [10-provider-portal § Acceptance page](./10-provider-portal.md#5-acceptance-page--login-free-appproviderprovideraccepttokenpagetsx) |
| B9 reputation panel | [10-provider-portal § Dashboard KPIs](./10-provider-portal.md#4-provider-dashboard-appproviderproviderdashboardpagetsx) |

## D. Agentic system (scope/features.md § C)

| Feature | Tech plan |
|---|---|
| C1 6-agent pipeline | [07-agents](./07-agents.md) |
| C2 22 tools | [06-tools](./06-tools.md) |
| C3 trace persistence | [02-database § agent_traces](./02-database.md#0003_bookings_and_tracessql), [05-antigravity-setup § Trace mirroring](./05-antigravity-setup.md#5-trace-mirroring) |
| C4 live trace viewer | [11-trace-viewer](./11-trace-viewer.md) |

## E. PWA features (scope/features.md § D)

| Feature | Tech plan |
|---|---|
| D1 installable PWA | [04-pwa-and-push § Manifest + SW](./04-pwa-and-push.md#1-manifest) |
| D2 fully responsive | [04-pwa-and-push § 6](./04-pwa-and-push.md#6-responsiveness-checklist) |
| D3 RTL Urdu | [01-bootstrap § next-intl](./01-bootstrap.md#5-locale--theme--middleware-skeleton), [09-customer-ui § i18n](./09-customer-ui.md#9-i18n-strings) |
| D4 Web Push | [04-pwa-and-push § 4](./04-pwa-and-push.md#4-push-subscription-flow) |

## F. Demo polish (scope/features.md § E)

| Feature | Tech plan |
|---|---|
| E1 seed data | [02-database § seed](./02-database.md#3-seed-data-supabaseseedsql), [15-demo-prep](./15-demo-prep.md) |
| E2 sample queries | [11-trace-viewer § Demo dashboard](./11-trace-viewer.md#4-demo-dashboard-apptracedemopagetsx) |
| E3 trace replay | [11-trace-viewer § Replay](./11-trace-viewer.md#replay) |

---

## G. Tables (scope/data-model.md)

| Table | Migration |
|---|---|
| `users_profile` | [02-database § 0002](./02-database.md#0002_core_tablessql) |
| `user_locations` | same |
| `service_categories` | same |
| `providers` | same |
| `agent_traces` | [02-database § 0003](./02-database.md#0003_bookings_and_tracessql) |
| `bookings` | same |
| `reminders` | [02-database § 0004](./02-database.md#0004_reminders_ratings_mocks_pushsql) |
| `ratings` | same |
| `mock_messages` | same |
| `push_subscriptions` | same |
| RLS policies | [02-database § 0005](./02-database.md#0005_rlssql) |
| pg_cron jobs | [02-database § 0006](./02-database.md#0006_pg_cronsql) |
| RPCs | [06-tools § Supabase RPC](./06-tools.md#3-supabase-rpc-tools) |

---

## H. Routes (scope/technical-architecture.md repo layout)

Every route in scope is enumerated and assigned in [08-api-routes.md](./08-api-routes.md).

---

## I. Decisions locked (scope/scope.md § Decisions locked in)

| Decision | Tech plan reference |
|---|---|
| Seed + live Places | [06-tools § Places](./06-tools.md#2-google-tools), [02-database § seed](./02-database.md#3-seed-data-supabaseseedsql) |
| LLM via Antigravity directly (Gemini under the hood); direct-Gemini SDK fallback only if SDK gaps surface | [05-antigravity-setup § LLM access](./05-antigravity-setup.md#6-llm-access--antigravity-native-decision-locked) |
| Web-only + WhatsApp webhook stretch | [10-provider-portal](./10-provider-portal.md), [12-reminders-and-notify § notify_provider](./12-reminders-and-notify.md#3-notify_provider-strategy-chain-recap) |

---

## J. Rubric criteria coverage (scope/scope.md § Why this scope wins)

| Rubric weight | Tech plan files that satisfy it |
|---|---|
| Antigravity orchestration (25%) | 05, 06, 07, 11 |
| Agentic reasoning (20%) | 07, 11 |
| Matching quality (20%) | 07 (Discovery + Ranking), 06 (Google tools), 02 (Postgres geo + RPC) |
| Action simulation (15%) | 07 (Booking, Follow-up), 12 (notify + reminders), 02 (mock_messages + state transitions) |
| Technical implementation (10%) | 01, 02, 03, 04, 08, 14 |
| Innovation & UX (10%) | 03 (multi-location), 04 (PWA), 09 (chat + RTL), 10 (login-free accept), 11 (trace UX), 12 (mock-mode UI) |

If any rubric row has a thin column, the implementation lacks emphasis there — fix during the relevant phase.
