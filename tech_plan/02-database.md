# 02 — Database (Supabase / Postgres)

Schema, extensions, RLS, pg_cron, seeds.

[← back to README](./README.md) · scope: [data-model.md](../scope/data-model.md)

---

## 1. Enable extensions

In Supabase SQL editor (or migration `0001_extensions.sql`):

```sql
create extension if not exists postgis;
create extension if not exists btree_gist;
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

> All four are available on Supabase free tier. Verify in **Database → Extensions**.

---

## 2. Migrations

Create one migration file per logical group under `supabase/migrations/`. Use timestamp prefixes when generating via Supabase CLI.

### `0002_core_tables.sql`

```sql
-- users_profile (1:1 with auth.users)
create table users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  preferred_locale text not null default 'en',
  default_location_id uuid,
  created_at timestamptz not null default now()
);

-- user_locations
create table user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address_text text not null,
  point geography(Point, 4326) not null,
  city text,
  town_or_area text,
  country_code text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_locations_user_id_idx on user_locations(user_id);

-- service_categories (reference data)
create table service_categories (
  slug text primary key,
  name_en text not null,
  name_ur text not null,
  icon text,
  keywords text[] not null default '{}'
);

-- providers
create table providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  business_name text not null,
  slug text unique,
  photo_url text,
  phone text,
  phone_verified boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  languages text[] not null default '{en}',
  categories text[] not null default '{}',
  service_area geometry(Polygon, 4326),
  service_radius_km numeric,
  hub_location geography(Point, 4326),
  weekly_hours jsonb not null default '{}',
  blackout_dates date[] not null default '{}',
  price_band jsonb not null default '{}',
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  response_time_minutes integer,
  avg_duration interval not null default '1 hour',
  published boolean not null default false,
  source text not null default 'self_onboarded',
  external_place_id text,
  created_at timestamptz not null default now()
);
create index providers_categories_gin on providers using gin(categories);
create index providers_hub_gist on providers using gist(hub_location);
create index providers_service_area_gist on providers using gist(service_area);
```

### `0003_bookings_and_traces.sql`

```sql
create table agent_traces (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  parent_step_id uuid references agent_traces(id),
  agent_name text not null,
  step_index integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  inputs jsonb,
  outputs jsonb,
  tool_calls jsonb,
  reasoning text,
  status text not null default 'ok',
  error jsonb
);
create index agent_traces_run_idx on agent_traces(run_id, step_index);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id),
  customer_user_location_id uuid not null references user_locations(id),
  customer_name_snapshot text,
  customer_phone_snapshot text,
  customer_lang text not null default 'en',
  provider_id uuid not null references providers(id),
  service_category text not null references service_categories(slug),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  location_text text not null,
  location_point geography(Point, 4326) not null,
  status text not null default 'invitation_sent',
  invitation_token text unique not null,
  invitation_channel text,
  invitation_sent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  price_estimate jsonb,
  agent_run_id uuid,
  receipt_pdf_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prevent double-booking
alter table bookings add constraint no_overlap_per_provider
  exclude using gist (
    provider_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('invitation_sent','confirmed','reminded','in_progress'));

create index bookings_customer_idx on bookings(customer_user_id, slot_start desc);
create index bookings_provider_idx on bookings(provider_id, slot_start desc);
create index bookings_status_idx on bookings(status) where status in ('invitation_sent','reminded');
```

### `0004_reminders_ratings_mocks_push.sql`

```sql
create table reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  status text not null default 'queued',
  payload jsonb,
  sent_at timestamptz,
  attempts integer not null default 0
);
create index reminders_due_queued_idx on reminders(due_at) where status = 'queued';

create table ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings(id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create or replace function recompute_provider_rating() returns trigger as $$
begin
  update providers p set
    rating_avg = (select avg(stars) from ratings r join bookings b on b.id = r.booking_id where b.provider_id = p.id),
    rating_count = (select count(*) from ratings r join bookings b on b.id = r.booking_id where b.provider_id = p.id)
  where p.id = (select provider_id from bookings where id = new.booking_id);
  return new;
end;
$$ language plpgsql;

create trigger ratings_after_insert after insert on ratings
for each row execute function recompute_provider_rating();

create table mock_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  channel text not null,
  to_phone text not null,
  body text not null,
  accept_url text not null,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
```

### `0005_rls.sql`

Per [data-model.md § RLS sketch](../scope/data-model.md#rls-sketch), but hardened:

```sql
alter table users_profile enable row level security;
alter table user_locations enable row level security;
alter table providers enable row level security;
alter table bookings enable row level security;
alter table agent_traces enable row level security;
alter table reminders enable row level security;
alter table ratings enable row level security;
alter table mock_messages enable row level security;
alter table push_subscriptions enable row level security;

-- users_profile
create policy users_profile_self on users_profile for all using (user_id = auth.uid());

-- user_locations
create policy user_locations_self on user_locations for all using (user_id = auth.uid());

-- providers (everyone reads published; owner writes)
create policy providers_read_published on providers for select using (published = true);
create policy providers_owner_all on providers for all using (owner_user_id = auth.uid());

-- bookings (customer + provider can read; provider can update status)
create policy bookings_customer_select on bookings for select using (customer_user_id = auth.uid());
create policy bookings_provider_select on bookings for select using (
  provider_id in (select id from providers where owner_user_id = auth.uid())
);
create policy bookings_provider_update on bookings for update using (
  provider_id in (select id from providers where owner_user_id = auth.uid())
);

-- ratings (customer can write own, anyone can read aggregated via providers row)
create policy ratings_customer_insert on ratings for insert with check (
  exists(select 1 from bookings b where b.id = booking_id and b.customer_user_id = auth.uid())
);

-- agent_traces, reminders, mock_messages — server only via service-role; no anon policies.
```

### `0006_pg_cron.sql`

```sql
-- drain_due_reminders: scans reminders and POSTs to /api/reminders/fire
create or replace function drain_due_reminders() returns void as $$
declare r record;
begin
  for r in
    select id, booking_id, kind from reminders
    where status = 'queued' and due_at <= now() and attempts < 5
    for update skip locked
  loop
    perform net.http_post(
      url := current_setting('app.reminders_fire_url', true),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.reminders_fire_secret', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('reminder_id', r.id, 'booking_id', r.booking_id, 'kind', r.kind)
    );
    update reminders set attempts = attempts + 1 where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- sweep expired invitations
create or replace function sweep_expired_invitations() returns void as $$
begin
  update bookings set status = 'rejected', updated_at = now()
  where status = 'invitation_sent'
    and invitation_sent_at < now() - interval '15 minutes';
end;
$$ language plpgsql security definer;

-- schedule both every minute
select cron.schedule('drain-reminders', '* * * * *', $$ select drain_due_reminders() $$);
select cron.schedule('sweep-invitations', '* * * * *', $$ select sweep_expired_invitations() $$);
```

After running this, set the two app settings:

```sql
alter database postgres set app.reminders_fire_url = 'https://<vercel-app>.vercel.app/api/reminders/fire';
alter database postgres set app.reminders_fire_secret = '<REMINDERS_FIRE_SECRET>';
```

For local dev, override these to a tunnel URL (e.g. `ngrok http 3000`).

---

## 3. Seed data (`supabase/seed.sql`)

- **8 service categories** with bilingual names + Roman Urdu keywords.
  ```sql
  insert into service_categories(slug, name_en, name_ur, icon, keywords) values
    ('ac_repair','AC Technician','اے سی ٹیکنیشن','snowflake', array['ac','air conditioner','cooling','thanda','gas','kool']),
    ('plumber','Plumber','پلمبر','wrench', array['plumber','pani','leakage','pipe','tap','nal']),
    ('electrician','Electrician','الیکٹریشن','zap', array['electrician','wiring','bijli','meter','switch','light']),
    ('tutor','Tutor','استاد','book-open', array['tutor','teacher','ustad','math','physics','english']),
    ('beautician','Beautician','بیوٹیشن','sparkles', array['beautician','salon','makeup','hair','threading']),
    ('carpenter','Carpenter','بڑھئی','hammer', array['carpenter','furniture','wood','barhai']),
    ('car_wash','Car Wash','کار واش','car', array['car wash','dhulai','detailing']),
    ('mobile_repair','Mobile Repair','موبائل ریپیئر','smartphone', array['mobile','phone','screen','battery']);
  ```
- **~30 providers** distributed across Islamabad sectors. Each row uses fake names ("Ali AC Services", "G-13 Plumbing Co"), `+92 300 555 01xx` phones, `@example.com` emails. Use `ST_GeomFromText('POINT(73.0 33.6)')` for points.
- **3 sample completed bookings** with ratings.
- **3 sample agent_traces** for the demo's "Replay" feature.

Keep the seed file under 600 lines for readability; large insert blocks are fine.

---

## 4. Generate types

```bash
supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
```

Add to `package.json` scripts:
```json
"db:types": "supabase gen types typescript --project-id <ref> > lib/supabase/types.ts"
```

---

## 5. Supabase clients

`lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts` — boilerplate from Supabase Next.js docs (App Router pattern).

Add a helper `lib/supabase/admin.ts` that uses `SUPABASE_SERVICE_ROLE_KEY` for the reminder-fire endpoint, pg_cron-driven actions, and seed scripts.

---

## Acceptance for 02-database

- [ ] All 4 extensions installed and visible in Supabase UI.
- [ ] All tables exist, RLS enabled on each.
- [ ] Seed runs without error; 30 providers visible in **Table Editor**.
- [ ] Exclusion constraint blocks a second booking on the same provider+slot.
- [ ] `select drain_due_reminders();` returns without error.
- [ ] `select cron.job;` shows two scheduled jobs.
- [ ] `lib/supabase/types.ts` generated and committed.
