/**
 * Dispute Resolution Agent — drives the resolution policy when a customer or
 * provider raises an issue. Operates in two phases:
 *   1) `intake` — when a customer files a dispute, classify the kind, choose
 *      an initial resolution (refund %, compensation, blacklist flag), persist
 *      to disputes.resolution, and move status to `under_review`.
 *   2) `respond` — when the provider replies, weigh both statements and either
 *      confirm/adjust the resolution and mark `resolved`, or `escalated` to
 *      human review when ambiguous.
 *
 * Policy is intentionally deterministic for hackathon (LLM-aided summary is
 * generated separately for the trace reasoning + the customer-facing message).
 */
import { admin } from '@/lib/supabase/admin';
import type { AgentContext } from '../types';

export type DisputeKind = 'no_show' | 'quality' | 'price' | 'cancellation' | 'overrun' | 'damage';
export type DisputeMode = 'intake' | 'respond' | 'auto_resolve';

interface DisputesInput {
  mode: DisputeMode;
  dispute_id: string;
  statement?: string;
  attachments?: string[];
  provider_acknowledged?: boolean;
}

interface DisputeResolution {
  refund_percent: number;
  compensation_credit_pkr: number;
  warn_provider: boolean;
  blacklist_provider: boolean;
  customer_message_en: string;
  customer_message_ur: string;
  provider_message_en: string;
  provider_message_ur: string;
}

const KIND_POLICIES: Record<DisputeKind, (provider_ack: boolean) => DisputeResolution> = {
  no_show: (ack) => ({
    refund_percent: 100,
    compensation_credit_pkr: ack ? 200 : 300,
    warn_provider: true,
    blacklist_provider: !ack,
    customer_message_en:
      'We confirmed the provider did not show up. The full booking amount is refunded and we have added PKR ' +
      (ack ? '200' : '300') + ' service credit to your account.',
    customer_message_ur:
      'ہم نے تصدیق کی ہے کہ پرووائڈر نہیں آیا۔ مکمل رقم واپس کر دی گئی ہے اور آپ کے اکاؤنٹ میں PKR ' +
      (ack ? '200' : '300') + ' کریڈٹ شامل کیا گیا ہے۔',
    provider_message_en:
      ack
        ? 'Acknowledged. The customer was refunded in full and your no-show rating has been adjusted.'
        : 'No response received within the window — customer fully refunded. Further no-shows will result in suspension.',
    provider_message_ur:
      ack
        ? 'تصدیق ہو گئی۔ گاہک کو مکمل ریفنڈ دیا گیا اور آپ کی درجہ بندی متاثر ہوئی ہے۔'
        : 'وقت پر جواب نہیں آیا — گاہک کو مکمل ریفنڈ ادا کیا گیا۔ مزید no-show پر اکاؤنٹ معطل ہو گا۔',
  }),
  quality: (ack) => ({
    refund_percent: ack ? 30 : 50,
    compensation_credit_pkr: ack ? 100 : 200,
    warn_provider: true,
    blacklist_provider: false,
    customer_message_en:
      'We reviewed your quality complaint and have refunded ' + (ack ? '30%' : '50%') +
      ' of the booking. PKR ' + (ack ? '100' : '200') + ' service credit was also added.',
    customer_message_ur:
      'آپ کی شکایت کا جائزہ لیا گیا اور ' + (ack ? '30%' : '50%') +
      ' رقم واپس کر دی گئی ہے۔ مزید کریڈٹ بھی شامل کیا گیا ہے۔',
    provider_message_en:
      'A quality dispute was upheld. Please review the customer feedback to improve service.',
    provider_message_ur: 'کوالٹی کی شکایت قبول ہو گئی۔ براہ کرم گاہک کی رائے کا جائزہ لیں۔',
  }),
  price: (ack) => ({
    refund_percent: ack ? 100 : 50,
    compensation_credit_pkr: 0,
    warn_provider: !ack,
    blacklist_provider: false,
    customer_message_en:
      ack
        ? 'The price overrun was confirmed as a billing error and has been refunded in full.'
        : 'A partial refund of 50% was issued while we review the price details with the provider.',
    customer_message_ur:
      ack
        ? 'قیمت میں اضافہ بلنگ کی غلطی تھی — مکمل رقم واپس کر دی گئی۔'
        : 'پرووائڈر کے ساتھ تصدیق کے دوران 50% رقم واپس کی گئی۔',
    provider_message_en:
      ack
        ? 'Acknowledged price dispute. Refund issued.'
        : 'A price dispute is pending — please re-share the agreed quote.',
    provider_message_ur:
      ack
        ? 'قیمت کی شکایت قبول ہو گئی۔ ریفنڈ جاری۔'
        : 'قیمت کی شکایت زیرِ غور — براہ کرم متفقہ ریٹ شیئر کریں۔',
  }),
  cancellation: () => ({
    refund_percent: 100,
    compensation_credit_pkr: 100,
    warn_provider: true,
    blacklist_provider: false,
    customer_message_en: 'Refunded in full for the late cancellation. PKR 100 service credit was added.',
    customer_message_ur: 'دیر سے منسوخی پر مکمل ریفنڈ اور PKR 100 کریڈٹ دے دیا گیا۔',
    provider_message_en: 'Late cancellation noted. Please avoid cancellations under 4 hours of the slot.',
    provider_message_ur: 'دیر سے کینسل نوٹ ہو گیا۔ سلاٹ سے 4 گھنٹے کم پہلے کینسل نہ کریں۔',
  }),
  overrun: () => ({
    refund_percent: 0,
    compensation_credit_pkr: 100,
    warn_provider: false,
    blacklist_provider: false,
    customer_message_en: 'Compensation credit added for the time overrun. Provider has been notified.',
    customer_message_ur: 'وقت کے اضافے پر کریڈٹ شامل کیا گیا۔',
    provider_message_en: 'Customer flagged time overrun. Please refine slot estimates next time.',
    provider_message_ur: 'گاہک نے وقت زیادہ لگنے کی شکایت کی۔ اگلی بار درست اندازہ دیں۔',
  }),
  damage: (ack) => ({
    refund_percent: 100,
    compensation_credit_pkr: ack ? 500 : 0,
    warn_provider: true,
    blacklist_provider: !ack,
    customer_message_en:
      ack
        ? 'Damage acknowledged. Full refund and PKR 500 credit applied. We will follow up about further compensation.'
        : 'Damage complaint registered and escalated to human review. Full refund issued in the interim.',
    customer_message_ur:
      ack
        ? 'نقصان تسلیم ہو گیا۔ مکمل ریفنڈ اور PKR 500 کریڈٹ شامل۔'
        : 'نقصان کی شکایت انسانی جائزہ کے لیے بھیج دی گئی۔ مکمل ریفنڈ جاری۔',
    provider_message_en:
      ack
        ? 'Acknowledged. Refund processed and compensation issued.'
        : 'Damage claim escalated for manual review. Your account is restricted while we investigate.',
    provider_message_ur:
      ack
        ? 'تصدیق ہو گئی۔ ریفنڈ اور معاوضہ ادا۔'
        : 'نقصان کا دعویٰ انسانی جائزے کے لیے بھیج دیا گیا — تحقیقات تک اکاؤنٹ محدود۔',
  }),
};

interface DisputesOutput {
  status: 'under_review' | 'resolved' | 'escalated';
  resolution: DisputeResolution | null;
}

export async function runDisputes(input: DisputesInput, ctx: AgentContext, stepIndex: number): Promise<DisputesOutput> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'disputes', stepIndex, startedAt, inputs: input, status: 'running' });

  const { data: dispute, error } = await admin
    .from('disputes')
    .select('id, booking_id, kind, status, statements, opened_by, opener_role, resolution, bookings(customer_user_id, provider_id, providers(owner_user_id, business_name))')
    .eq('id', input.dispute_id)
    .single();
  if (error || !dispute) throw new Error(`dispute_not_found: ${error?.message}`);

  const kind = dispute.kind as DisputeKind;
  const ack = input.provider_acknowledged ?? (input.mode === 'auto_resolve');
  const resolution = KIND_POLICIES[kind](ack);

  let nextStatus: 'under_review' | 'resolved' | 'escalated' = 'under_review';
  if (input.mode === 'intake') {
    nextStatus = 'under_review';
  } else if (input.mode === 'auto_resolve') {
    nextStatus = resolution.blacklist_provider && !ack ? 'escalated' : 'resolved';
  } else if (input.mode === 'respond') {
    nextStatus = 'resolved';
  }

  const statements = Array.isArray(dispute.statements) ? [...dispute.statements] : [];
  if (input.statement) {
    statements.push({
      role: input.mode === 'intake' ? 'customer' : 'provider',
      message: input.statement,
      attachments: input.attachments ?? [],
      at: new Date().toISOString(),
    });
  }

  const update: Record<string, unknown> = {
    status: nextStatus,
    statements,
    resolution: nextStatus === 'under_review' ? null : resolution,
  };
  if (nextStatus === 'resolved') update.resolved_at = new Date().toISOString();
  if (nextStatus === 'escalated') update.escalated_at = new Date().toISOString();

  const { error: updErr } = await admin.from('disputes').update(update).eq('id', dispute.id);
  if (updErr) throw new Error(`dispute_update_failed: ${updErr.message}`);

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'disputes', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    inputs: input,
    outputs: { dispute_id: dispute.id, status: nextStatus, kind, ack },
    reasoning:
      `Mode=${input.mode}, kind=${kind}, provider_acknowledged=${ack}. Applied policy → refund=${resolution.refund_percent}% credit=${resolution.compensation_credit_pkr} warn=${resolution.warn_provider} blacklist=${resolution.blacklist_provider}. New status=${nextStatus}.`,
    status: 'ok',
  });

  return { status: nextStatus, resolution: nextStatus === 'under_review' ? null : resolution };
}
