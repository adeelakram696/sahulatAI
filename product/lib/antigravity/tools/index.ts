/**
 * Tool registry — single source of truth for Antigravity tool wiring.
 */
import { geocodeTool, distanceMatrixTool, placesNearbyTool } from './google';
import {
  searchProvidersTool, checkAvailabilityTool, createBookingTool,
  updateBookingStatusTool, enqueueReminderTool,
} from './supabase-rpc';
import { notifyProviderTool } from './notify-provider';
import { webPushTool } from './push';
import { calendarArtifactsTool, generateReceiptTool, confirmationMessageTool } from './artifacts';
import { computePriceTool } from './pricing';

export const ALL_TOOLS = {
  'google.geocode': geocodeTool,
  'google.distance_matrix': distanceMatrixTool,
  'google.places_nearby': placesNearbyTool,
  'supabase.search_providers': searchProvidersTool,
  'supabase.check_availability': checkAvailabilityTool,
  'supabase.create_booking': createBookingTool,
  'supabase.update_booking_status': updateBookingStatusTool,
  'supabase.enqueue_reminder': enqueueReminderTool,
  'notify_provider': notifyProviderTool,
  'web_push.send': webPushTool,
  'generate_calendar_artifacts': calendarArtifactsTool,
  'generate_receipt': generateReceiptTool,
  'llm.confirmation_message': confirmationMessageTool,
  'compute_price': computePriceTool,
} as const;

export type ToolName = keyof typeof ALL_TOOLS;

export async function callTool<T = unknown>(
  name: string,
  args: unknown,
  ctx: { runId: string; userId?: string; logger: { tool: (n: string, p?: unknown) => void; warn: (m: string, d?: unknown) => void } },
): Promise<T> {
  const tool = (ALL_TOOLS as Record<string, { input: { parse: (x: unknown) => unknown }; run: (parsed: unknown, ctx: unknown) => Promise<unknown> }>)[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  const parsed = tool.input.parse(args);
  return (await tool.run(parsed, ctx)) as T;
}
