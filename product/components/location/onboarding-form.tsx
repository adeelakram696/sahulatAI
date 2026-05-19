'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Home as HomeIcon,
  Briefcase,
  MapPin,
  Navigation,
  ChevronDown,
  CheckCircle2,
  Search,
  ArrowRight,
} from 'lucide-react';

interface Resolved {
  point: { lat: number; lng: number };
  city: string | null;
  town_or_area: string | null;
  country_code: string;
  formatted_address: string;
}

// Quick-pick presets so the demo flow (canonical Islamabad query) stays one tap away.
const QUICK_PICKS: Resolved[] = [
  { point: { lat: 33.6469, lng: 72.9560 }, city: 'Islamabad', town_or_area: 'G-13', country_code: 'PK', formatted_address: 'G-13, Islamabad' },
  { point: { lat: 33.6928, lng: 72.9853 }, city: 'Islamabad', town_or_area: 'F-11', country_code: 'PK', formatted_address: 'F-11, Islamabad' },
  { point: { lat: 33.7160, lng: 72.9930 }, city: 'Islamabad', town_or_area: 'F-7',  country_code: 'PK', formatted_address: 'F-7, Islamabad' },
  { point: { lat: 31.5204, lng: 74.3587 }, city: 'Lahore',    town_or_area: 'Gulberg', country_code: 'PK', formatted_address: 'Gulberg, Lahore' },
  { point: { lat: 24.8607, lng: 67.0011 }, city: 'Karachi',   town_or_area: 'Saddar',  country_code: 'PK', formatted_address: 'Saddar, Karachi' },
];

export default function LocationOnboardingForm({ userId: _userId }: { userId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addressInput, setAddressInput] = useState('');
  const [streetDetails, setStreetDetails] = useState('');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  async function resolveByText() {
    if (!addressInput.trim()) return;
    setResolving(true);
    try {
      const res = await fetch('/api/locations/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: addressInput }),
      });
      if (!res.ok) throw new Error('lookup failed');
      const data = (await res.json()) as Resolved;
      setResolved(data);
      if (!data.city) toast.warning('Address resolved but city unknown — saving as typed.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResolving(false);
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported by this browser');
      return;
    }
    setResolving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/locations/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (!res.ok) throw new Error('reverse geocode failed');
          const data = (await res.json()) as Resolved;
          setResolved(data);
          setAddressInput(data.formatted_address);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setResolving(false);
        }
      },
      (err) => {
        setResolving(false);
        toast.error(err.message || 'Could not get your location');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!resolved) {
      toast.error('Pick a location first');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        address_text: streetDetails
          ? `${streetDetails}, ${resolved.formatted_address}`
          : resolved.formatted_address,
        lat: resolved.point.lat,
        lng: resolved.point.lng,
        city: resolved.city,
        town_or_area: resolved.town_or_area,
        country_code: resolved.country_code,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      toast.error(`Could not save: ${err.error?.message ?? 'unknown'}`);
      return;
    }
    toast.success('Location saved');
    router.push('/chat');
    router.refresh();
  }

  const LABEL_OPTIONS = [
    { value: 'Home',  Icon: HomeIcon  },
    { value: 'Work',  Icon: Briefcase },
    { value: 'Other', Icon: MapPin    },
  ] as const;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Field label="Label">
        <div className="grid grid-cols-3 gap-2">
          {LABEL_OPTIONS.map(({ value, Icon }) => {
            const selected = label === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setLabel(value)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98] ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent'
                }`}
              >
                <Icon className="size-3.5" strokeWidth={2.2} />
                {value}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Find your location">
        <div className="flex items-stretch gap-2">
          <div className="flex-1 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" strokeWidth={2.2} />
            <input
              type="text"
              value={addressInput}
              onChange={(e) => { setAddressInput(e.target.value); setResolved(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveByText(); } }}
              placeholder="Type a city, neighborhood, or full address"
              className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-[13.5px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={resolveByText}
            disabled={resolving || !addressInput.trim()}
            className="rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground hover:border-primary/40 hover:bg-accent active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {resolving ? '…' : 'Find'}
          </button>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={resolving}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
        >
          <Navigation className="size-3.5" strokeWidth={2.2} />
          Use my current location
        </button>
      </Field>

      {resolved && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="size-8 shrink-0 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="size-4" strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">Location resolved</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                {resolved.formatted_address}
              </p>
              {resolved.city && (
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  {resolved.town_or_area ? `${resolved.town_or_area}, ` : ''}{resolved.city}
                  {' · '}
                  {resolved.point.lat.toFixed(4)}, {resolved.point.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <details className="group rounded-xl border border-border/70 bg-muted/20 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none flex items-center justify-between px-3.5 py-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span>Or pick a demo area (Pakistan)</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2.2} />
        </summary>
        <div className="px-3.5 pb-3 grid grid-cols-2 gap-2">
          {QUICK_PICKS.map((p) => {
            const selected = resolved?.formatted_address === p.formatted_address;
            return (
              <button
                key={p.formatted_address}
                type="button"
                onClick={() => { setResolved(p); setAddressInput(p.formatted_address); }}
                className={`rounded-lg border px-3 py-2 text-[12px] font-medium text-left transition-all active:scale-[0.98] ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent'
                }`}
              >
                {p.formatted_address}
              </button>
            );
          })}
        </div>
      </details>

      <Field label="Street / details (optional)">
        <input
          type="text"
          value={streetDetails}
          onChange={(e) => setStreetDetails(e.target.value)}
          placeholder="House 1, Street 1"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all"
        />
      </Field>

      <button
        type="submit"
        disabled={saving || !resolved}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient text-white py-3 text-[14px] font-semibold shadow-primary-sm hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all"
      >
        {saving ? 'Saving…' : (
          <>
            Save &amp; continue to chat
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </>
        )}
      </button>
      {!resolved && (
        <p className="text-center text-[11px] text-muted-foreground/80 -mt-2">
          Find or pick a location above to continue
        </p>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
