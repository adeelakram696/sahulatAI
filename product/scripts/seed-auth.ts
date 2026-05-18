/**
 * Seed demo Supabase Auth users (Ayesha, Ali, Tutor) + Home/Work locations.
 * Run with: pnpm db:seed:auth
 *
 * Idempotent: safe to re-run; uses upsert/get-or-create semantics.
 */
/**
 * Run with: pnpm db:seed:auth
 * Loads env automatically via tsx's --env-file flag (see package.json script).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type DemoUser = {
  email: string;
  password: string;
  display_name: string;
  locations?: { label: string; address: string; lat: number; lng: number; city: string; town: string }[];
  is_provider?: { business_name: string; slug: string };
};

const USERS: DemoUser[] = [
  {
    email: 'ayesha@example.com',
    password: 'Demo!1234',
    display_name: 'Ayesha (demo customer)',
    locations: [
      { label: 'Home',  address: 'House 1, Street 1, G-13/1, Islamabad', lat: 33.6469, lng: 72.9560, city: 'Islamabad', town: 'G-13' },
      { label: 'Work',  address: 'Sector F-7, Islamabad',                  lat: 33.7160, lng: 72.9930, city: 'Islamabad', town: 'F-7' },
    ],
  },
  {
    email: 'ali@example.com',
    password: 'Demo!1234',
    display_name: 'Ali (demo provider)',
    is_provider: { business_name: 'Ali AC Services', slug: 'ali-ac-services' },
  },
  {
    email: 'tutor@example.com',
    password: 'Demo!1234',
    display_name: 'Bright Tutors Demo Owner',
    is_provider: { business_name: 'Bright Tutors', slug: 'bright-tutors' },
  },
];

async function getOrCreateUser(u: DemoUser): Promise<string> {
  // List and find by email (admin API)
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
  if (existing) {
    console.log(`  ↻ exists: ${u.email}`);
    return existing.id;
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { display_name: u.display_name },
  });
  if (error) throw error;
  console.log(`  ✓ created: ${u.email}`);
  return created.user!.id;
}

async function main() {
  console.log('→ Seeding demo users…');
  for (const u of USERS) {
    const userId = await getOrCreateUser(u);

    // Seed locations
    if (u.locations?.length) {
      for (const loc of u.locations) {
        const point = `SRID=4326;POINT(${loc.lng} ${loc.lat})`;
        const { error } = await admin
          .from('user_locations')
          .upsert(
            {
              user_id: userId,
              label: loc.label,
              address_text: loc.address,
              point,
              city: loc.city,
              town_or_area: loc.town,
              country_code: 'PK',
            },
            { onConflict: 'user_id,label', ignoreDuplicates: true },
          );
        if (error) console.warn(`     ! location ${loc.label}:`, error.message);
      }
    }

    // Link to provider row if applicable
    if (u.is_provider) {
      const { error } = await admin
        .from('providers')
        .update({ owner_user_id: userId })
        .eq('slug', u.is_provider.slug);
      if (error) console.warn(`     ! provider link for ${u.is_provider.slug}:`, error.message);
    }
  }
  console.log('✅ Demo users seeded.');
}

main().catch((e) => {
  console.error('❌ seed-auth failed:', e);
  process.exit(1);
});
