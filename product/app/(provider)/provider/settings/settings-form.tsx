'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const ALL_CATEGORIES = [
  'ac_repair','plumber','electrician','tutor','beautician','carpenter','car_wash',
  'car_mechanic','mobile_repair','house_cleaning','cook','painter','mason',
  'appliance_repair','gardening','pest_control',
];

interface Provider {
  id: string;
  business_name: string;
  phone: string | null;
  phone_verified: boolean;
  whatsapp_opt_in: boolean;
  sms_opt_in: boolean;
  categories: string[];
  service_radius_km: number | null;
  published: boolean;
  languages: string[];
  certifications?: string[] | null;
  tools_required?: string[] | null;
}

export default function ProviderSettingsForm({ initial }: { initial: Provider }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initial.business_name);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [whatsappOptIn, setWhatsappOptIn] = useState(initial.whatsapp_opt_in);
  const [smsOptIn, setSmsOptIn] = useState(initial.sms_opt_in);
  const [cats, setCats] = useState<string[]>(initial.categories ?? []);
  const [radiusKm, setRadiusKm] = useState<number>(initial.service_radius_km ?? 5);
  const [published, setPublished] = useState(initial.published);
  const [certifications, setCertifications] = useState((initial.certifications ?? []).join(', '));
  const [toolsRequired, setToolsRequired] = useState((initial.tools_required ?? []).join(', '));
  const [pending, setPending] = useState(false);

  const toggle = (s: string) =>
    setCats((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName) return toast.error('Business name required');
    if (cats.length === 0) return toast.error('Pick at least one category');
    setPending(true);
    const supabase = createClient();
    const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const { error } = await supabase
      .from('providers')
      .update({
        business_name: businessName,
        phone,
        whatsapp_opt_in: whatsappOptIn,
        sms_opt_in: smsOptIn,
        categories: cats,
        service_radius_km: radiusKm,
        published,
        certifications: splitCsv(certifications),
        tools_required: splitCsv(toolsRequired),
        price_band: Object.fromEntries(cats.map((c) => [c, { min: 1000, max: 3000 }])),
      })
      .eq('id', initial.id);
    setPending(false);
    if (error) return toast.error(error.message);
    toast.success('Saved');
    router.push('/provider/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Field label="Business name">
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required
          placeholder="e.g. Hassan AC Services"
          className="input-field" />
      </Field>

      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+92 300 0000000"
          className="input-field" />
        <p className="text-xs text-muted-foreground mt-1.5">
          {initial.phone_verified ? '✓ Verified' : 'Not verified yet'}
        </p>
      </Field>

      <Field label="Service categories">
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => toggle(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all capitalize ${
                cats.includes(c)
                  ? 'border-primary bg-primary/10 text-primary shadow-xs'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}>
              {c.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Service radius — ${radiusKm} km`}>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={25} value={radiusKm}
            onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
            className="flex-1 accent-primary" />
          <span className="text-sm font-semibold text-foreground w-12 text-right">{radiusKm} km</span>
        </div>
      </Field>

      <Field label="Notifications">
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer hover:bg-accent transition-colors">
            <input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Receive invitations on WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">Customers will reach you via WhatsApp message</p>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer hover:bg-accent transition-colors">
            <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Also send by SMS</p>
              <p className="text-[11px] text-muted-foreground">Fallback if WhatsApp isn&apos;t available</p>
            </div>
          </label>
        </div>
      </Field>

      <Field label="Certifications" hint="e.g. Gas Safe, EPA 608, NEC Wiring — boosts your ranking for complex jobs.">
        <input value={certifications} onChange={(e) => setCertifications(e.target.value)}
          placeholder="Gas Safe, EPA 608, PEMRA"
          className="input-field" />
      </Field>

      <Field label="Specialist tools" hint="Tools you carry — used for job-complexity matching and shown to customers.">
        <input value={toolsRequired} onChange={(e) => setToolsRequired(e.target.value)}
          placeholder="vacuum pump, multimeter, pipe cutter"
          className="input-field" />
      </Field>

      <Field label="Profile visibility">
        <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer hover:bg-accent transition-colors">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">Published</p>
            <p className="text-[11px] text-muted-foreground">Visible to customers searching for services</p>
          </div>
        </label>
      </Field>

      <button type="submit" disabled={pending} className="btn-primary w-full !py-2.5 !text-sm">
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {children}
    </div>
  );
}
