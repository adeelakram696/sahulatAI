/**
 * POST /api/places/contact
 *
 * Simulates contacting a Google-Places-only provider (one not registered in our DB)
 * with a pre-filled service-request message + a footer inviting them to join SahuliatAI.
 *
 * For hackathon: writes the rendered message into `mock_messages` so it shows up
 * in the trace drawer and in the dashboard's mock-mode card. Returns the
 * rendered message so the UI can show it back to the user as confirmation.
 *
 * Real-world: this would hit Twilio SMS / WhatsApp / SMTP. Same shape.
 */
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

const Body = z.object({
  place_id: z.string().min(1),
  business_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  google_maps_url: z.string().url().nullable().optional(),
  service_category: z.string().min(1),
  requested_time: z.string().min(1),
  user_message: z.string().max(500).default(''),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    return Response.json({ error: { message: 'invalid body', issues: (e as z.ZodError).issues } }, { status: 400 });
  }

  // Resolve the customer's display name + phone (snapshot for the message body)
  const { data: profile } = await supabase
    .from('users_profile')
    .select('display_name, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  const customerName = profile?.display_name ?? user.email ?? 'a SahuliatAI customer';
  const channel: 'sms' | 'email' = body.email ? 'email' : 'sms';
  const recipient = body.email ?? body.phone ?? 'unknown';

  // Render the body. Includes a "join SahuliatAI" invitation for non-registered providers.
  const messageBody = [
    `Hi ${body.business_name},`,
    ``,
    `${customerName} is requesting your service via SahuliatAI:`,
    `  Service: ${prettyService(body.service_category)}`,
    `  When: ${body.requested_time}`,
    body.user_message ? `  Note: ${body.user_message}` : null,
    ``,
    `If you'd like to accept this request, reply to this message or call back.`,
    ``,
    `———`,
    `📲 Want to manage bookings automatically? Join SahuliatAI:`,
    `   ${env.NEXT_PUBLIC_APP_URL}/for-business?ref=${body.place_id}`,
    `   You'll get real-time invitations from customers near you with no extra app needed.`,
  ].filter(Boolean).join('\n');

  // Persist into mock_messages so it shows in the trace / mock-mode card.
  // We don't have a booking_id (provider isn't in our DB) — using a NULL-tolerant
  // alt-table would be cleaner, but for hackathon we reuse mock_messages with a
  // synthetic booking-less row by inserting into a separate table.
  //
  // Workaround: write a row into a small `places_contacts` table that mirrors
  // mock_messages but with a place_id instead of booking_id.
  try {
    await admin.from('places_contacts').insert({
      user_id: user.id,
      place_id: body.place_id,
      business_name: body.business_name,
      channel,
      recipient,
      body: messageBody,
    });
  } catch (e) {
    // Table not yet migrated → fall through; still return success so the UI flow continues.
    console.warn('[places/contact] mock_messages-like persist skipped:', (e as Error).message);
  }

  return Response.json({
    ok: true,
    channel,
    recipient,
    body: messageBody,
  });
}

function prettyService(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
