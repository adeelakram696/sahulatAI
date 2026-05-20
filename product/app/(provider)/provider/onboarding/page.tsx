'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES = [
  { slug: 'ac_repair',        label: 'AC Repair' },
  { slug: 'plumber',          label: 'Plumber' },
  { slug: 'electrician',      label: 'Electrician' },
  { slug: 'tutor',            label: 'Tutor' },
  { slug: 'beautician',       label: 'Beautician' },
  { slug: 'carpenter',        label: 'Carpenter' },
  { slug: 'car_wash',         label: 'Car Wash' },
  { slug: 'car_mechanic',     label: 'Car Mechanic' },
  { slug: 'mobile_repair',    label: 'Mobile Repair' },
  { slug: 'house_cleaning',   label: 'House Cleaning' },
  { slug: 'cook',             label: 'Cook' },
  { slug: 'painter',          label: 'Painter' },
  { slug: 'mason',            label: 'Mason' },
  { slug: 'appliance_repair', label: 'Appliance Repair' },
  { slug: 'gardening',        label: 'Gardener' },
  { slug: 'pest_control',     label: 'Pest Control' },
];

const SECTORS = [
  { label: 'G-13, Islamabad', lat: 33.6469, lng: 72.9560 },
  { label: 'F-11, Islamabad', lat: 33.6928, lng: 72.9853 },
  { label: 'F-7, Islamabad',  lat: 33.7160, lng: 72.9930 },
  { label: 'I-8, Islamabad',  lat: 33.6776, lng: 73.0700 },
];

export default function ProviderOnboarding() {
  const router = useRouter();
  const search = useSearchParams();
  const refPlaceId = search.get('ref');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('+92 300 555 0199');
  const [cats, setCats] = useState<string[]>([]);
  const [sector, setSector] = useState(SECTORS[0]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [pending, setPending] = useState(false);
  const [claimMode, setClaimMode] = useState<{ business_name: string; phone: string | null } | null>(null);

  // A user who already owns a provider must not onboard again (would insert a
  // second providers row) — send them straight to the dashboard.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase
        .from('providers')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (existing) router.replace('/provider/dashboard');
    })();
  }, [router]);

  // If signed in with a ?ref=<place_id>, pre-fill from the ghost provider row
  useEffect(() => {
    if (!refPlaceId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('providers')
        .select('business_name, phone, categories, owner_user_id')
        .eq('external_place_id', refPlaceId)
        .maybeSingle();
      if (data && !data.owner_user_id) {
        setClaimMode({ business_name: data.business_name, phone: data.phone });
        setBusinessName(data.business_name);
        if (data.phone) setPhone(data.phone);
        if (data.categories?.length) setCats(data.categories);
      }
    })();
  }, [refPlaceId]);

  const toggleCat = (slug: string) =>
    setCats((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName || cats.length === 0) return toast.error('Name + at least 1 category required');
    setPending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPending(false); router.push('/auth/signin'); return; }

    // CLAIM PATH: ghost row already exists for this place_id; transfer ownership
    if (refPlaceId && claimMode) {
      const { data: claimRows, error: claimErr } = await supabase.rpc('claim_places_provider', { p_place_id: refPlaceId });
      if (claimErr) { setPending(false); toast.error(claimErr.message); return; }
      const claim = claimRows?.[0];
      if (!claim?.claimed) { setPending(false); toast.error('Could not claim — already owned by someone else?'); return; }
      // After claim, update categories + service area + hours
      const { error: updErr } = await supabase
        .from('providers')
        .update({
          business_name: businessName,
          phone,
          whatsapp_opt_in: whatsappOptIn,
          sms_opt_in: false,
          languages: ['en', 'ur'],
          categories: cats,
          service_radius_km: radiusKm,
          hub_location: `SRID=4326;POINT(${sector.lng} ${sector.lat})`,
          weekly_hours: { mon: ['09:00', '18:00'], tue: ['09:00', '18:00'], wed: ['09:00', '18:00'], thu: ['09:00', '18:00'], fri: ['09:00', '18:00'] },
          price_band: Object.fromEntries(cats.map((c) => [c, { min: 1000, max: 3000 }])),
          avg_duration: '1 hour 30 minutes',
        })
        .eq('id', claim.provider_id);
      setPending(false);
      if (updErr) { toast.error(updErr.message); return; }
      toast.success('Business claimed! Your pending bookings are now visible in your dashboard.');
      router.push('/provider/dashboard');
      return;
    }

    // NEW PROVIDER PATH (default)
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
    const { error } = await supabase.from('providers').insert({
      owner_user_id: user.id,
      business_name: businessName,
      slug: `${slug}-${user.id.slice(0, 6)}`,
      phone,
      phone_verified: true, // mock OTP per Round 3 decision
      whatsapp_opt_in: whatsappOptIn,
      sms_opt_in: false,
      languages: ['en', 'ur'],
      categories: cats,
      service_radius_km: radiusKm,
      hub_location: `SRID=4326;POINT(${sector.lng} ${sector.lat})`,
      weekly_hours: { mon: ['09:00', '18:00'], tue: ['09:00', '18:00'], wed: ['09:00', '18:00'], thu: ['09:00', '18:00'], fri: ['09:00', '18:00'] },
      price_band: Object.fromEntries(cats.map((c) => [c, { min: 1000, max: 3000 }])),
      avg_duration: '1 hour 30 minutes',
      published: true,
    });
    setPending(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Published!');
    router.push('/provider/dashboard');
  }

  return (
    <main className="container max-w-2xl py-10">
      <h1 className="text-2xl font-bold mb-1">
        {claimMode ? `Claim ${claimMode.business_name}` : 'List your service'}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        {claimMode
          ? `You're claiming a business listed on Google. After you finish, any pending customer bookings will appear in your dashboard.`
          : 'Quick onboarding — 5 fields, then live.'}
      </p>

      {claimMode && (
        <div className="mb-6 rounded-md border border-purple-200 bg-purple-50 dark:bg-purple-950/10 p-3 text-sm">
          <p className="font-medium">Claiming an existing Google listing</p>
          <p className="text-xs text-muted-foreground mt-1">
            We pre-filled some info. Adjust as needed, then publish to take ownership.
          </p>
        </div>
      )}

      <form onSubmit={publish} className="space-y-6">
        <Field label="Business name">
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
            required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>

        <Field label="Phone (mock OTP — any code accepted)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>

        <Field label="Categories">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.slug} type="button" onClick={() => toggleCat(c.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  cats.includes(c.slug) ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Hub sector">
          <select value={sector.label} onChange={(e) => setSector(SECTORS.find((s) => s.label === e.target.value)!)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {SECTORS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        </Field>

        <Field label={`Service radius: ${radiusKm} km`}>
          <input type="range" min={1} max={20} value={radiusKm} onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
            className="w-full" />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} />
          Send invitations via WhatsApp
        </label>

        <button type="submit" disabled={pending}
          className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50">
          {pending ? 'Publishing…' : 'Publish & open dashboard'}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
