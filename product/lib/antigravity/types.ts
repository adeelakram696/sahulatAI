/**
 * Shared types for agents, tools, events, traces.
 */
import { z } from 'zod';

export type AgentName = 'planner' | 'intent_parser' | 'discovery' | 'ranking' | 'booking' | 'followup' | 'disputes';

export type AppEvent =
  | 'new_request'
  | 'clarification_reply'
  | 'slot_selected'
  | 'booking_invitation_sent'
  | 'booking_confirmed'
  | 'invitation_expired'
  | 'reminder_due'
  | 'completion_check_due'
  | 'rating_prompt_due'
  | 'rating_submitted'
  | 'service_status_changed';

export interface TraceStep {
  runId: string;
  parentStepId?: string;
  agentName: AgentName | 'system';
  stepIndex: number;
  startedAt: string;
  endedAt?: string;
  inputs?: unknown;
  outputs?: unknown;
  toolCalls?: Array<{ tool: string; args: unknown; result?: unknown; latencyMs?: number; error?: string }>;
  reasoning?: string;
  status: 'ok' | 'running' | 'error' | 'needs_input';
  error?: { message: string };
}

export interface ToolContext {
  runId: string;
  userId?: string;
  logger: { tool: (name: string, payload?: unknown) => void; warn: (msg: string, data?: unknown) => void };
}

export interface Tool<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  description: string;
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>>;
}

export interface AgentContext extends ToolContext {
  emitTrace: (step: TraceStep) => Promise<void>;
  callTool: <T = unknown>(name: string, args: unknown) => Promise<T>;
}

export interface Agent<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: AgentName;
  model?: string;
  systemPrompt: string;
  tools: string[];
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: AgentContext) => Promise<z.infer<O>>;
}

/** Plan emitted by Planner */
export const PlanSchema = z.object({
  plan: z.array(z.object({
    agent: z.enum(['planner', 'intent_parser', 'discovery', 'ranking', 'booking', 'followup', 'await_user']),
    input: z.unknown(),
    depends_on: z.string().optional(),
  })),
  reasoning: z.string(),
  expected_artifacts: z.array(z.string()),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Intent emitted by Intent Parser */
export const IntentSchema = z.object({
  service_slug: z.string(),
  service_confidence: z.number().min(0).max(1),
  location: z.object({
    text: z.string(),
    point: z.object({ lat: z.number(), lng: z.number() }),
    source: z.enum(['user_location', 'user_mentioned', 'ambiguous']),
    confidence: z.number().min(0).max(1),
  }),
  time: z.object({
    iso: z.string(),
    original_phrase: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  urgency: z.enum(['now', 'today', 'tomorrow', 'this_week']),
  notes: z.string().default(''),
  complexity: z.enum(['basic', 'intermediate', 'complex']).default('basic'),
  budget_preference: z.enum(['low', 'mid', 'high']).nullable().optional(),
  needs_clarification: z.object({
    field: z.string(),
    question_en: z.string(),
    question_ur: z.string(),
  }).optional(),
});
export type Intent = z.infer<typeof IntentSchema>;

/** Provider candidate */
export const ProviderCandidateSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  photo_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  google_maps_url: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  languages: z.array(z.string()),
  google_rating: z.number().default(0),
  google_rating_count: z.number().default(0),
  portal_rating: z.number().default(0),
  portal_rating_count: z.number().default(0),
  response_time_minutes: z.number().nullable().optional(),
  avg_duration_minutes: z.number().default(60),
  hub_lat: z.number(),
  hub_lng: z.number(),
  distance_m: z.number(),
  price_band: z.record(z.unknown()).default({}),
  whatsapp_opt_in: z.boolean().default(false),
  sms_opt_in: z.boolean().default(false),
  source: z.enum(['self_onboarded', 'places_api']),
  // 8-factor matching additions:
  on_time_score: z.number().default(0.85),
  cancellation_rate: z.number().default(0.05),
  last_review_at: z.string().nullable().optional(),
  risk_score: z.number().default(0.10),
  specializations: z.array(z.string()).default([]),
  capacity: z.number().default(1),
  base_visit_fee: z.number().default(500),
  base_hourly_rate: z.number().default(800),
});
export type ProviderCandidate = z.infer<typeof ProviderCandidateSchema>;

/** Per-pick factor breakdown (visible in trace + UI) */
export const FactorBreakdownSchema = z.object({
  distance: z.number(),
  rating_with_recency: z.number(),
  on_time: z.number(),
  availability: z.number(),
  cancel_inverse: z.number(),
  price_fit: z.number(),
  language: z.number(),
  user_pref: z.number(),
  specialization_bonus: z.number().default(0),
});
export type FactorBreakdown = z.infer<typeof FactorBreakdownSchema>;

/** Ranked provider with score + reasoning */
export const RankedProviderSchema = ProviderCandidateSchema.extend({
  score: z.number(),
  factors: FactorBreakdownSchema.optional(),
  reasoning: z.object({ en: z.string(), ur: z.string() }),
  is_bookable: z.boolean(),
  available: z.boolean(),
});
export type RankedProvider = z.infer<typeof RankedProviderSchema>;
