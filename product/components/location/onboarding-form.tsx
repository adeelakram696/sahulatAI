'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Field label="Label">
        <div className="flex gap-2">
          {(['Home', 'Work', 'Other'] as const).map((opt) => (
            <button key={opt} type="button" onClick={() => setLabel(opt)}
              className={`flex-1 rounded-md border py-2 text-sm font-medium ${
                label === opt ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Find your location">
        <div className="flex gap-2">
          <input
            type="text" value={addressInput}
            onChange={(e) => { setAddressInput(e.target.value); setResolved(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveByText(); } }}
            placeholder="Type a city, neighborhood, or full address"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button type="button" onClick={resolveByText} disabled={resolving || !addressInput.trim()}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">
            {resolving ? '…' : 'Find'}
          </button>
        </div>
        <button type="button" onClick={useMyLocation} disabled={resolving}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          📍 Use my current location
        </button>
      </Field>

      {resolved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-3 text-sm">
          <p className="font-medium">Resolved</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {resolved.formatted_address}
          </p>
          {resolved.city && (
            <p className="text-xs text-muted-foreground">
              {resolved.town_or_area ? `${resolved.town_or_area}, ` : ''}{resolved.city}
              {' · '}
              {resolved.point.lat.toFixed(4)}, {resolved.point.lng.toFixed(4)}
            </p>
          )}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Or pick a demo area (Pakistan)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {QUICK_PICKS.map((p) => (
            <button key={p.formatted_address} type="button"
              onClick={() => { setResolved(p); setAddressInput(p.formatted_address); }}
              className={`rounded-md border px-3 py-2 text-xs text-left ${
                resolved?.formatted_address === p.formatted_address ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {p.formatted_address}
            </button>
          ))}
        </div>
      </details>

      <Field label="Street / details (optional)">
        <input type="text" value={streetDetails} onChange={(e) => setStreetDetails(e.target.value)}
          placeholder="House 1, Street 1"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>

      <button type="submit" disabled={saving || !resolved}
        className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save & continue to chat'}
      </button>
    </form>
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
