import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';

const MAX_PHOTOS = 5;
const BUCKET = 'booking-evidence';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { id } = await params;

  // Only the provider who owns the booking can upload evidence.
  const { data: booking } = await admin
    .from('bookings')
    .select('id, evidence_photos, providers!inner(owner_user_id)')
    .eq('id', id)
    .maybeSingle();

  if (!booking) return Response.json({ error: 'booking not found' }, { status: 404 });
  const ownerUserId = (booking.providers as unknown as { owner_user_id: string } | null)?.owner_user_id;
  if (ownerUserId !== user.id) return new Response('forbidden', { status: 403 });

  const existing: string[] = (booking.evidence_photos as string[] | null) ?? [];
  if (existing.length >= MAX_PHOTOS) {
    return Response.json({ error: `Maximum ${MAX_PHOTOS} photos allowed per booking.` }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: 'No file provided.' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Only image files are accepted.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File exceeds 5 MB limit.' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${id}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadErr) return Response.json({ error: uploadErr.message }, { status: 500 });

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: updateErr } = await admin
    .from('bookings')
    .update({ evidence_photos: [...existing, publicUrl] })
    .eq('id', id);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });
  return Response.json({ ok: true, url: publicUrl, total: existing.length + 1 });
}
