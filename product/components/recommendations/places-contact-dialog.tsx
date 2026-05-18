'use client';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  provider: {
    id: string;
    business_name: string;
    phone?: string | null;
    website?: string | null;
    google_maps_url?: string | null;
  };
  serviceCategory: string;
  requestedTime: string;
}

interface ServerResponse { channel: 'sms' | 'email'; recipient: string; body: string }

export default function PlacesContactDialog({ open, onClose, provider, serviceCategory, requestedTime }: Props) {
  const [userMessage, setUserMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ServerResponse | null>(null);

  if (!open) return null;

  async function send() {
    setSending(true);
    try {
      const res = await fetch('/api/places/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: provider.id,
          business_name: provider.business_name,
          phone: provider.phone ?? null,
          email: null, // Places API doesn't return email; SMS path used
          google_maps_url: provider.google_maps_url ?? null,
          service_category: serviceCategory,
          requested_time: requestedTime,
          user_message: userMessage,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ServerResponse;
      setSent(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <SentSuccess sent={sent} provider={provider} onClose={onClose} />
        ) : (
          <ComposeForm
            provider={provider}
            serviceCategory={serviceCategory}
            requestedTime={requestedTime}
            userMessage={userMessage}
            setUserMessage={setUserMessage}
            sending={sending}
            onSend={send}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function ComposeForm({
  provider, serviceCategory, requestedTime, userMessage, setUserMessage, sending, onSend, onClose,
}: {
  provider: Props['provider']; serviceCategory: string; requestedTime: string;
  userMessage: string; setUserMessage: (v: string) => void;
  sending: boolean; onSend: () => void; onClose: () => void;
}) {
  const channelText = provider.phone ? `SMS to ${provider.phone}` : `Mock channel (no phone available)`;

  return (
    <>
      <header className="mb-4">
        <p className="text-xs text-muted-foreground">Contact provider</p>
        <h2 className="text-lg font-semibold">{provider.business_name}</h2>
        <p className="text-xs text-muted-foreground mt-1">via {channelText}</p>
      </header>

      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs space-y-1 mb-4">
        <p><span className="text-muted-foreground">Service:</span> {prettyService(serviceCategory)}</p>
        <p><span className="text-muted-foreground">When:</span> {requestedTime}</p>
      </div>

      <label className="block text-sm font-medium mb-1.5">Optional note</label>
      <textarea
        rows={3}
        value={userMessage}
        onChange={(e) => setUserMessage(e.target.value)}
        placeholder="Anything you want to add (e.g. exact address, urgency)…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <p className="text-[11px] text-muted-foreground mt-2">
        Your message will include a footer inviting <span className="font-medium">{provider.business_name}</span> to join SahuliatAI for easier booking.
      </p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={onClose}
          className="rounded-md border border-border py-2 text-sm font-medium">
          Cancel
        </button>
        <button onClick={onSend} disabled={sending}
          className="rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </>
  );
}

function SentSuccess({ sent, provider, onClose }: { sent: ServerResponse; provider: Props['provider']; onClose: () => void }) {
  return (
    <>
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-emerald-600">✓</span>
          <h2 className="text-lg font-semibold">Sent to {provider.business_name}</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Channel: <span className="font-medium uppercase">{sent.channel}</span> · Recipient: {sent.recipient}
        </p>
      </header>

      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs mb-3">
        <p className="font-medium mb-1">Demo Mode</p>
        <p>
          {sent.channel === 'sms' ? 'SMS' : 'Email'} provider not configured. Message body shown below — in production this would be delivered automatically.
        </p>
      </div>

      <pre className="rounded-md border border-border bg-muted/40 p-3 text-[11px] whitespace-pre-wrap font-mono max-h-64 overflow-auto">
{sent.body}
      </pre>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {provider.phone && (
          <a href={`tel:${provider.phone}`}
            className="rounded-md border border-border py-2 text-sm font-medium text-center">
            Call directly
          </a>
        )}
        <button onClick={onClose}
          className={`rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium ${provider.phone ? '' : 'col-span-2'}`}>
          Close
        </button>
      </div>
    </>
  );
}

function prettyService(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
