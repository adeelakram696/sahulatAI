# SahuliatAI — Tech Plan

Implementation plan derived from [`scope/`](../scope/scope.md). Each file is a focused build doc with **eval criteria** at the end.

> **The implementation is done when every check in [`evals.md`](./evals.md) passes.**

---

## Reading order

| # | File | When to read |
|---|---|---|
| 00 | [00-prereqs.md](./00-prereqs.md) | Before the hackathon clock starts |
| 01 | [01-bootstrap.md](./01-bootstrap.md) | Phase 1 hour 0 |
| 02 | [02-database.md](./02-database.md) | Phase 1 hour 0–2 (in parallel with bootstrap) |
| 03 | [03-auth-and-onboarding.md](./03-auth-and-onboarding.md) | Phase 1 hour 2–6 |
| 04 | [04-pwa-and-push.md](./04-pwa-and-push.md) | Phase 1 hour 6–8 |
| 05 | [05-antigravity-setup.md](./05-antigravity-setup.md) | Phase 2 hour 8 (after Phase-0 smoke test confirms SDK shape) |
| 06 | [06-tools.md](./06-tools.md) | Phase 2 hour 10–16 |
| 07 | [07-agents.md](./07-agents.md) | Phase 2 hour 14–22 |
| 08 | [08-api-routes.md](./08-api-routes.md) | Phase 2 hour 18–22 |
| 09 | [09-customer-ui.md](./09-customer-ui.md) | Phase 3 (overlaps with Phase 2) |
| 10 | [10-provider-portal.md](./10-provider-portal.md) | Phase 4 |
| 11 | [11-trace-viewer.md](./11-trace-viewer.md) | Phase 5 |
| 12 | [12-reminders-and-notify.md](./12-reminders-and-notify.md) | Phase 6 |
| 13 | [13-testing.md](./13-testing.md) | Continuous; final pass before demo |
| 14 | [14-deploy.md](./14-deploy.md) | Phase 7 |
| 15 | [15-demo-prep.md](./15-demo-prep.md) | Phase 7, last 4 hours |

### Meta docs

| File | Purpose |
|---|---|
| [coverage-matrix.md](./coverage-matrix.md) | Proves every scope item has a home. |
| [evals.md](./evals.md) | **Master verification rubric.** Brief evals + rubric evals. The bar for "done." |
| [open-questions.md](./open-questions.md) | Items deliberately left to the team's call; each has a default. |

---

## How to use this plan

1. **Stand-up (Phase 0)**: skim everything; assign owners per [milestones.md § roles](../scope/milestones.md#suggested-roles-for-a-team-of-3); run the prereq checklist.
2. **Per phase**: open the matching numbered file. Work tasks top-to-bottom. Tick off the **Acceptance for …** checklist before moving to the next.
3. **Continuous**: keep [evals.md](./evals.md) open in a tab. As features land, tick off the brief + rubric checks. Anything still red 4 hours before submission becomes the priority.
4. **Coverage anxiety**: if you're not sure whether scope item X is covered, look it up in [coverage-matrix.md](./coverage-matrix.md). Every scope row is mapped.

---

## Coverage claim (1-line summary)

Every scope feature → at least one tech_plan section. Every tech_plan section → an explicit Acceptance checklist. Every Acceptance check → a brief- or rubric-eval entry in [evals.md](./evals.md). Tick the evals, ship the project.

---

## Cross-references

- Scope folder: [`scope/`](../scope/scope.md)
