import { z } from 'zod';
import webpush from 'web-push';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Tool } from '../types';

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails('mailto:team@example.com', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  }
  return false;
}

const Input = z.object({
  user_id: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
});
const Output = z.object({ sent: z.number() });

export const webPushTool: Tool<typeof Input, typeof Output> = {
  name: 'web_push.send',
  description: 'Deliver a web push notification to a user.',
  input: Input,
  output: Output,
  async run({ user_id, title, body, url }, ctx) {
    ctx.logger.tool('web_push.send', { user_id });
    if (!ensureVapid()) {
      ctx.logger.warn('VAPID keys not set; web_push noop');
      return { sent: 0 };
    }
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', user_id);
    if (!subs || subs.length === 0) return { sent: 0 };

    const payload = JSON.stringify({ title, body, url: url ?? '/' });
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } },
          payload,
        ),
      ),
    );
    // Clean up dead subscriptions
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        const status = (r.reason as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          await admin.from('push_subscriptions').delete().eq('endpoint', subs[i].endpoint);
        }
      }
    }
    return { sent: results.filter((r) => r.status === 'fulfilled').length };
  },
};
