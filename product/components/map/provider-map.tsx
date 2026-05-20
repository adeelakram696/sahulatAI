'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { SERVICE_CATEGORIES, getCategory } from '@/lib/services/categories';
import { ServiceIcon } from '@/components/ui/service-icon';
import { RatingBadges } from '@/components/ui/rating-badges';
import { toast } from 'sonner';

interface Provider {
  id: string;
  business_name: string;
  photo_url: string | null;
  phone: string | null;
  google_rating: number;
  google_rating_count: number;
  portal_rating: number;
  portal_rating_count: number;
  categories: string[];
  hub_lat: number;
  hub_lng: number;
  distance_m: number | null;
}

export default function ProviderMap({ initialCenter, apiKey }: { initialCenter: { lat: number; lng: number }; apiKey: string }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(initialCenter.lat),
          lng: String(initialCenter.lng),
          radius_km: '10',
        });
        if (selectedSlug) params.set('slug', selectedSlug);
        const res = await fetch(`/api/providers/nearby?${params}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { providers: Provider[] };
        if (!cancelled) setProviders(data.providers);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message || 'Failed to load providers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [initialCenter.lat, initialCenter.lng, selectedSlug]);

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/10 p-6 text-sm">
        <p className="font-medium">Map view unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">
          Set <code className="text-[10px] bg-background border border-border px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> to enable the map.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CategoryFilters selected={selectedSlug} onSelect={setSelectedSlug} />

      <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: '70vh', minHeight: 480 }}>
        <APIProvider apiKey={apiKey}>
          <Map
            mapId="sahuliat-map"
            defaultCenter={initialCenter}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="w-full h-full"
          >
            <UserMarker point={initialCenter} />
            {providers.map((p) => (
              <ProviderMarker key={p.id} provider={p} onClick={setActiveProvider} />
            ))}
            {activeProvider && (
              <InfoWindow
                position={{ lat: activeProvider.hub_lat, lng: activeProvider.hub_lng }}
                onCloseClick={() => setActiveProvider(null)}
              >
                <ProviderPopover provider={activeProvider} />
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
        {loading && (
          <div className="absolute top-3 left-3 rounded-full bg-background/90 border border-border px-3 py-1 text-[11px] font-medium">
            Loading…
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {providers.length} providers within 10 km {selectedSlug ? `· ${getCategory(selectedSlug)?.label_en}` : ''}
      </p>
    </div>
  );
}

function CategoryFilters({ selected, onSelect }: { selected: string | null; onSelect: (slug: string | null) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${selected === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'}`}
      >
        All
      </button>
      {SERVICE_CATEGORIES.map((c) => (
        <button
          key={c.slug}
          onClick={() => onSelect(c.slug)}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border pl-1 pr-3 py-1 text-xs font-medium ${selected === c.slug ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'}`}
        >
          <ServiceIcon slug={c.slug} size="sm" />
          <span>{c.label_en}</span>
        </button>
      ))}
    </div>
  );
}

function UserMarker({ point }: { point: { lat: number; lng: number } }) {
  return (
    <AdvancedMarker position={point} title="You are here">
      <div className="size-4 rounded-full bg-blue-500 border-2 border-white shadow-md" />
    </AdvancedMarker>
  );
}

function ProviderMarker({ provider, onClick }: { provider: Provider; onClick: (p: Provider) => void }) {
  const primaryCategory = provider.categories?.[0];
  const cat = primaryCategory ? getCategory(primaryCategory) : undefined;
  return (
    <AdvancedMarker
      position={{ lat: provider.hub_lat, lng: provider.hub_lng }}
      onClick={() => onClick(provider)}
      title={provider.business_name}
    >
      <div className="flex flex-col items-center">
        <div className="border border-primary/40 rounded-full shadow-md overflow-hidden">
          <ServiceIcon slug={primaryCategory ?? ''} size="sm" />
        </div>
      </div>
    </AdvancedMarker>
  );
}

function ProviderPopover({ provider }: { provider: Provider }) {
  const slug = provider.categories?.[0];
  return (
    <div className="min-w-[200px] text-foreground">
      <p className="font-semibold text-sm">{provider.business_name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {(provider.categories ?? []).map((c) => getCategory(c)?.label_en ?? c).join(' · ')}
      </p>
      <div className="mt-1.5 space-y-1">
        <RatingBadges
          portalRating={provider.portal_rating}
          portalCount={provider.portal_rating_count}
          googleRating={provider.google_rating}
        />
        {provider.distance_m !== null && (
          <p className="text-xs text-muted-foreground">{(provider.distance_m! / 1000).toFixed(1)} km away</p>
        )}
      </div>
      {slug && (
        <Link
          href={`/chat?q=${encodeURIComponent(`I want to book ${provider.business_name}`)}&slug=${slug}&autosubmit=1`}
          className="mt-2 inline-block text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 font-medium"
        >
          Book via AI
        </Link>
      )}
    </div>
  );
}
