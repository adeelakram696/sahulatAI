import type { AppEvent, AgentContext } from '../types';

interface PlanCall { agent: string; input: unknown }
export interface Plan { plan: PlanCall[]; reasoning: string; expected_artifacts: string[] }

const DETERMINISTIC_MAP: Record<AppEvent, (payload: unknown) => Plan> = {
  new_request: (p) => ({
    plan: [
      { agent: 'intent_parser', input: p },
      { agent: 'discovery', input: { __chain: true } },
      { agent: 'ranking', input: { __chain: true } },
      { agent: 'await_user', input: {} },
    ],
    reasoning: 'New request from a customer — run the full discovery pipeline.',
    expected_artifacts: ['intent', 'recommendations'],
  }),
  clarification_reply: (p) => ({
    plan: [
      { agent: 'intent_parser', input: p },
      { agent: 'discovery', input: { __chain: true } },
      { agent: 'ranking', input: { __chain: true } },
      { agent: 'await_user', input: {} },
    ],
    reasoning: 'Clarification reply — re-run discovery pipeline with merged context.',
    expected_artifacts: ['intent', 'recommendations'],
  }),
  slot_selected: (p) => ({
    plan: [{ agent: 'booking', input: p }],
    reasoning: 'User selected a slot — create the invitation.',
    expected_artifacts: ['booking_id', 'confirmation_message'],
  }),
  booking_invitation_sent: () => ({
    plan: [],
    reasoning: 'Invitation already dispatched; nothing further.',
    expected_artifacts: [],
  }),
  booking_confirmed: (p) => ({
    plan: [{ agent: 'followup', input: { mode: 'enqueue_pre_appointment', ...(p as object) } }],
    reasoning: 'Provider accepted — enqueue pre-appointment + completion reminders.',
    expected_artifacts: ['reminders_enqueued'],
  }),
  invitation_expired: (p) => ({
    plan: [
      { agent: 'discovery', input: p },
      { agent: 'ranking', input: { __chain: true } },
      { agent: 'await_user', input: {} },
    ],
    reasoning: 'Invitation expired — re-recommend with the previous provider excluded.',
    expected_artifacts: ['recommendations'],
  }),
  reminder_due: (p) => ({
    plan: [{ agent: 'followup', input: { mode: 'dispatch', ...(p as object) } }],
    reasoning: 'Reminder due — dispatch notifications.',
    expected_artifacts: ['notifications_sent'],
  }),
  completion_check_due: (p) => ({
    plan: [{ agent: 'followup', input: { mode: 'check_completion', ...(p as object) } }],
    reasoning: 'Slot ended — transition status and enqueue rating prompt.',
    expected_artifacts: ['status_updated'],
  }),
  rating_prompt_due: (p) => ({
    plan: [{ agent: 'followup', input: { mode: 'send_rating_prompt', ...(p as object) } }],
    reasoning: 'Send rating prompt to customer.',
    expected_artifacts: ['notifications_sent'],
  }),
  rating_submitted: () => ({
    plan: [],
    reasoning: 'Rating recorded; reputation updated by trigger.',
    expected_artifacts: [],
  }),
  service_status_changed: (p) => ({
    plan: [{ agent: 'followup', input: { mode: 'dispatch_status_push', ...(p as object) } }],
    reasoning: 'Provider transitioned service state — push to customer.',
    expected_artifacts: ['notifications_sent'],
  }),
};

export async function runPlanner(event: AppEvent, payload: unknown, ctx: AgentContext): Promise<Plan> {
  const stepIndex = 0;
  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'planner', stepIndex,
    startedAt: new Date().toISOString(),
    inputs: { event, payload },
    status: 'running',
  });

  // For Phase 1 of impl, use deterministic map. Once LLM is verified,
  // swap to llm.plan with the deterministic map as fallback.
  const planner = DETERMINISTIC_MAP[event];
  if (!planner) {
    const err = `unknown event: ${event}`;
    await ctx.emitTrace({
      runId: ctx.runId, agentName: 'planner', stepIndex,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
      status: 'error', error: { message: err },
    });
    throw new Error(err);
  }
  const plan = planner(payload);
  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'planner', stepIndex,
    startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
    inputs: { event, payload }, outputs: plan,
    reasoning: plan.reasoning, status: 'ok',
  });
  return plan;
}
