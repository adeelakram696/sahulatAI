/**
 * Follow-up agent — 4 modes: enqueue_pre_appointment, dispatch, check_completion, send_rating_prompt.
 * Event-driven; reminders themselves are time-driven by Supabase pg_cron.
 */
import { admin } from '@/lib/supabase/admin';
import type { AgentContext } from '../types';
import { callTool } from '../tools';

type Mode = 'enqueue_pre_appointment' | 'dispatch' | 'check_completion' | 'send_rating_prompt' | 'dispatch_status_push';

interface FollowupInput { mode: Mode; booking_id: string; reminder_kind?: string; status?: string; title?: string }
interface FollowupOutput { enqueued: number; notifications_sent: number; status_updates: number }

export async function runFollowup(input: FollowupInput, ctx: AgentContext, stepIndex: number): Promise<FollowupOutput> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'followup', stepIndex, startedAt, inputs: input, status: 'running' });

  let enqueued = 0;
  let notificationsSent = 0;
  let statusUpdates = 0;

  const { data: booking } = await admin
    .from('bookings')
    .select('id, customer_user_id, provider_id, slot_start, slot_end, location_text, providers(business_name, owner_user_id)')
    .eq('id', input.booking_id)
    .single();
  if (!booking) throw new Error('booking not found');

  const provider = booking.providers as { business_name?: string; owner_user_id?: string } | null;

  switch (input.mode) {
    case 'enqueue_pre_appointment': {
      const preAt = new Date(new Date(booking.slot_start as string).getTime() - 60 * 60 * 1000).toISOString();
      const completionAt = new Date(booking.slot_end as string).toISOString();
      await callTool('supabase.enqueue_reminder', { booking_id: input.booking_id, kind: 'pre_appointment', due_at: preAt }, ctx);
      await callTool('supabase.enqueue_reminder', { booking_id: input.booking_id, kind: 'completion_check', due_at: completionAt }, ctx);
      enqueued += 2;
      break;
    }
    case 'dispatch': {
      const provName = provider?.business_name ?? 'Your provider';
      await callTool('web_push.send', {
        user_id: booking.customer_user_id,
        title: 'Service reminder',
        body: `${provName} arriving in 1 hour for your booking.`,
        url: `/booking/${booking.id}`,
      }, ctx);
      notificationsSent++;
      if (provider?.owner_user_id) {
        await callTool('web_push.send', {
          user_id: provider.owner_user_id,
          title: 'Upcoming service',
          body: `Reminder: ${booking.location_text} in 1 hour.`,
          url: '/provider/dashboard',
        }, ctx);
        notificationsSent++;
      }
      await callTool('supabase.update_booking_status', { booking_id: input.booking_id, status: 'reminded' }, ctx);
      statusUpdates++;
      break;
    }
    case 'check_completion': {
      // Auto-transition: confirmed/reminded → in_progress → completed
      await callTool('supabase.update_booking_status', { booking_id: input.booking_id, status: 'completed' }, ctx);
      statusUpdates++;
      const ratingAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await callTool('supabase.enqueue_reminder', { booking_id: input.booking_id, kind: 'rating_prompt', due_at: ratingAt }, ctx);
      enqueued++;
      break;
    }
    case 'send_rating_prompt': {
      await callTool('web_push.send', {
        user_id: booking.customer_user_id,
        title: 'How was your service?',
        body: `Rate ${provider?.business_name ?? 'your provider'}.`,
        url: `/bookings?rate=${booking.id}`,
      }, ctx);
      notificationsSent++;
      break;
    }
    case 'dispatch_status_push': {
      const provName = provider?.business_name ?? 'Your provider';
      const bodyText = input.status === 'en_route'
        ? `${provName} is on the way.`
        : input.status === 'arrived'
          ? `${provName} has arrived at your location.`
          : `${provName} started the service.`;
      await callTool('web_push.send', {
        user_id: booking.customer_user_id,
        title: input.title ?? 'Service update',
        body: bodyText,
        url: `/booking/${booking.id}`,
      }, ctx);
      notificationsSent++;
      break;
    }
  }

  const output: FollowupOutput = { enqueued, notifications_sent: notificationsSent, status_updates: statusUpdates };
  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'followup', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    inputs: input, outputs: output,
    reasoning: `Mode=${input.mode}: enqueued=${enqueued}, notifications=${notificationsSent}, status_updates=${statusUpdates}.`,
    status: 'ok',
  });
  return output;
}
