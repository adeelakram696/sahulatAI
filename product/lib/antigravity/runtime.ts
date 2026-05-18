/**
 * Workflow runtime — top-level orchestrator called by /api/agent/run.
 * Pulls a plan from Planner, then iteratively runs each agent in the plan,
 * streaming trace events to a callback (SSE consumer) and persisting to Supabase.
 */
import { randomUUID } from 'crypto';
import type { AppEvent, AgentContext, Intent, ProviderCandidate, RankedProvider } from './types';
import { persistTrace, createLogger, nextStepIndex } from './trace';
import { callTool } from './tools';
import { runPlanner } from './agents/planner';
import { runIntentParser } from './agents/intent-parser';
import { runDiscovery } from './agents/discovery';
import { runRanking } from './agents/ranking';
import { runBookingPhaseA } from './agents/booking';
import { runFollowup } from './agents/followup';

interface RunArgs {
  event: AppEvent;
  payload: Record<string, unknown>;
  userId?: string;
  runId?: string;
  onStep?: (step: { agent: string; status: string; reasoning?: string; outputs?: unknown }) => void;
}

export interface RunOutcome {
  runId: string;
  intent?: Intent;
  recommendations?: RankedProvider[];
  also_nearby?: RankedProvider[];
  needs_clarification?: { question_en: string; question_ur: string };
  booking_id?: string;
  invitation_channel?: string;
  message?: { en: string; ur: string };
  followup_summary?: unknown;
}

export async function runWorkflow({ event, payload, userId, runId, onStep }: RunArgs): Promise<RunOutcome> {
  const finalRunId = runId ?? randomUUID();
  const logger = createLogger(finalRunId);

  const baseCtx: AgentContext = {
    runId: finalRunId,
    userId,
    logger,
    emitTrace: async (step) => {
      await persistTrace(step);
      onStep?.({
        agent: step.agentName,
        status: step.status,
        reasoning: step.reasoning,
        outputs: step.outputs,
      });
    },
    callTool: (name, args) => callTool(name, args, { runId: finalRunId, userId, logger }),
  };

  const plan = await runPlanner(event, payload, baseCtx);
  const outcome: RunOutcome = { runId: finalRunId };

  let intent: Intent | undefined;
  let candidates: ProviderCandidate[] = [];

  for (const call of plan.plan) {
    const stepIndex = nextStepIndex(finalRunId);
    try {
      switch (call.agent) {
        case 'intent_parser': {
          intent = await runIntentParser(call.input as Parameters<typeof runIntentParser>[0], baseCtx, stepIndex);
          outcome.intent = intent;
          if (intent.needs_clarification) {
            outcome.needs_clarification = {
              question_en: intent.needs_clarification.question_en,
              question_ur: intent.needs_clarification.question_ur,
            };
            return outcome;
          }
          break;
        }
        case 'discovery': {
          if (!intent) break;
          const disc = await runDiscovery({ intent }, baseCtx, stepIndex);
          candidates = disc.candidates;
          break;
        }
        case 'ranking': {
          if (!intent) break;
          const ranked = await runRanking(
            { intent, candidates, user_location: { point: intent.location.point, address_text: intent.location.text } },
            baseCtx,
            stepIndex,
          );
          outcome.recommendations = ranked.top;
          outcome.also_nearby = ranked.also_nearby;
          break;
        }
        case 'booking': {
          const out = await runBookingPhaseA(call.input as Parameters<typeof runBookingPhaseA>[0], baseCtx, stepIndex);
          outcome.booking_id = out.booking_id;
          outcome.invitation_channel = out.invitation_channel;
          outcome.message = out.message;
          break;
        }
        case 'followup': {
          const out = await runFollowup(call.input as Parameters<typeof runFollowup>[0], baseCtx, stepIndex);
          outcome.followup_summary = out;
          break;
        }
        case 'await_user': {
          // Terminal: pipeline halts and waits for next event.
          return outcome;
        }
      }
    } catch (e) {
      await baseCtx.emitTrace({
        runId: finalRunId, agentName: 'system', stepIndex,
        startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
        status: 'error', error: { message: (e as Error).message },
      });
      throw e;
    }
  }

  return outcome;
}
