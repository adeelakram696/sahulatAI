-- Evidence photos and service checklist enhancements.
-- evidence_photos: array of Supabase Storage URLs uploaded by the provider.
-- service_checklist: already existed as jsonb; we keep it, just add the photos column.

alter table bookings
  add column if not exists evidence_photos text[] not null default '{}';

-- Storage bucket for booking evidence (created via Supabase dashboard or this migration).
-- The bucket must be created separately in the Storage UI; this migration documents the intent.
-- Bucket name: booking-evidence
-- Public: false (serve via signed URLs from the API route)
