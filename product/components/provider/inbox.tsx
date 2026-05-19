'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar,
  MapPin,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Play,
  Truck,
  MapPinCheck
} from 'lucide-react';

type ChecklistItem = { key: string; label: string; done: boolean };

interface Booking {
  id: string;
  status: string;
  slot_start: string;
  slot_end: string;
  service_category: string;
  location_text: string;
  invitation_sent_at: string;
  invitation_token: string;
  customer_name_snapshot: string | null;
  customer_phone_snapshot: string | null;
  notes?: string | null;
  invitation_channel?: string | null;
  service_checklist?: ChecklistItem[] | null;
  evidence_photos?: string[] | null;
}

const DEFAULT_CHECKLIST: Record<string, ChecklistItem[]> = {
  ac_repair: [
    { key: 'diagnosis', label: 'Diagnosis explained to customer', done: false },
    { key: 'gas_check', label: 'Gas / coolant level checked', done: false },
    { key: 'cleaning', label: 'Coils cleaned', done: false },
    { key: 'test_run', label: 'AC test-run for 10 minutes', done: false },
  ],
  plumber: [
    { key: 'site_check', label: 'Issue inspected on-site', done: false },
    { key: 'repair', label: 'Repair / replacement done', done: false },
    { key: 'leak_test', label: 'Leak / pressure test passed', done: false },
    { key: 'clean_up', label: 'Work area cleaned', done: false },
  ],
  electrician: [
    { key: 'power_off', label: 'Power isolated safely', done: false },
    { key: 'work_done', label: 'Wiring / fixture work completed', done: false },
    { key: 'continuity', label: 'Continuity & load test passed', done: false },
    { key: 'panel_back', label: 'Panel / cover secured', done: false },
  ],
};

function checklistFor(category: string): ChecklistItem[] {
  return DEFAULT_CHECKLIST[category] ?? [
    { key: 'arrived', label: 'On-site and started work', done: false },
    { key: 'completed', label: 'Job completed to customer satisfaction', done: false },
    { key: 'clean', label: 'Cleaned up after the work', done: false },
  ];
}

export default function ProviderInbox({
  provider, initialBookings,
}: { provider: { id: string; business_name: string }; initialBookings: Booking[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`provider_dashboard_${provider.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `provider_id=eq.${provider.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBookings((prev) => [payload.new as Booking, ...prev]);
            toast.message('New booking invitation', { description: 'Check your inbox.' });
          } else if (payload.eventType === 'UPDATE') {
            setBookings((prev) => prev.map((b) => b.id === (payload.new as Booking).id ? { ...b, ...(payload.new as Booking) } : b));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const invitations = bookings.filter((b) => b.status === 'invitation_sent' || b.status === 'query_sent');
  const upcoming = bookings.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status));
  const past = bookings.filter((b) => ['completed', 'cancelled', 'rejected'].includes(b.status));

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Pending Invitations Section */}
      <Section 
        title={`Invitations (${invitations.length})`} 
        subtitle="Respond promptly to claim these leads before they expire"
      >
        {invitations.length === 0 ? (
          <Empty text="No pending invitations." />
        ) : (
          <div className="space-y-3">
            {invitations.map((b) => (
              <InvitationCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </Section>

      {/* Active & Upcoming Jobs Section */}
      <Section title={`Upcoming & Active Jobs (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <Empty text="No active or upcoming jobs." />
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingRow 
                key={b.id} 
                b={b} 
                isExpanded={expandedId === b.id} 
                onToggle={() => toggleExpand(b.id)}
                providerBusinessName={provider.business_name}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Past History Section */}
      <Section title={`Past History (${past.length})`}>
        {past.length === 0 ? (
          <Empty text="No past bookings yet." />
        ) : (
          <div className="space-y-3">
            {past.slice(0, 15).map((b) => (
              <BookingRow 
                key={b.id} 
                b={b} 
                isExpanded={expandedId === b.id} 
                onToggle={() => toggleExpand(b.id)}
                providerBusinessName={provider.business_name}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border/80 rounded-xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 mb-4">{subtitle}</p>}
      <div className={`${!subtitle ? 'mt-4' : ''}`}>{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-8 text-center bg-muted/10">
      <p className="text-xs text-muted-foreground italic">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let styles = "";
  let label = status.replace('_', ' ');

  switch (status) {
    case 'invitation_sent':
    case 'query_sent':
      styles = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200";
      label = "pending response";
      break;
    case 'confirmed':
      styles = "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200";
      break;
    case 'reminded':
      styles = "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200";
      break;
    case 'en_route':
      styles = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 animate-pulse";
      label = 'on the way';
      break;
    case 'arrived':
      styles = "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200";
      break;
    case 'in_progress':
      styles = "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 animate-pulse font-semibold";
      break;
    case 'completed':
      styles = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200";
      break;
    case 'cancelled':
    case 'rejected':
      styles = "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200";
      break;
    default:
      styles = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-border";
  }

  return (
    <span className={`text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-full border font-medium ${styles}`}>
      {label}
    </span>
  );
}

function InvitationCard({ b }: { b: Booking }) {
  const isQuerySent = b.status === 'query_sent';
  const [pending, setPending] = useState<null | 'accept' | 'reject'>(null);
  const remaining = useCountdown(b.invitation_sent_at);

  async function handle(action: 'accept' | 'reject') {
    setPending(action);
    const url = action === 'accept' ? '/api/provider/accept' : '/api/provider/reject';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: b.invitation_token }),
    });
    setPending(null);
    if (!res.ok) {
      toast.error(`${action === 'accept' ? 'Accepting' : 'Rejecting'} booking failed.`);
    } else {
      toast.success(action === 'accept' ? 'Booking accepted!' : 'Booking declined.');
    }
  }

  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-md ${
      isQuerySent 
        ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/5' 
        : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/5'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground">
              {b.customer_name_snapshot || 'Customer'}
            </h3>
            <span className="text-xs text-muted-foreground font-normal">·</span>
            <span className="text-xs bg-muted border border-border px-2 py-0.5 rounded text-muted-foreground capitalize">
              {b.service_category.replace('_', ' ')}
            </span>
            {isQuerySent && (
              <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 text-purple-800 px-2 py-0.5">
                Google Lead
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span>{new Date(b.slot_start).toLocaleString()}</span>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
            <span className="truncate">{b.location_text}</span>
          </div>

          {b.notes && String(b.notes).trim().length > 0 && (
            <div className="text-xs mt-2 rounded-lg bg-background border border-border/60 p-2.5 italic text-muted-foreground">
              <span className="font-semibold not-italic block text-[10px] uppercase tracking-wide text-foreground/80 mb-0.5">Customer Notes:</span>
              "{b.notes}"
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[11px] font-mono font-bold px-2 py-1 rounded-md">
            <Clock className="size-3" />
            <span>{remaining}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button 
          onClick={() => handle('reject')} 
          disabled={pending !== null || remaining === 'expired'}
          className="flex-1 rounded-lg border border-border bg-background hover:bg-accent text-xs font-semibold py-2 px-3 transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="size-3.5" />
          {pending === 'reject' ? 'Declining...' : 'Decline'}
        </button>
        <button 
          onClick={() => handle('accept')} 
          disabled={pending !== null || remaining === 'expired'}
          className="flex-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold py-2 px-3 transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Check className="size-3.5" />
          {pending === 'accept' ? 'Accepting...' : 'Accept Job'}
        </button>
      </div>
    </div>
  );
}

function BookingRow({ 
  b, 
  isExpanded, 
  onToggle,
  providerBusinessName 
}: { 
  b: Booking; 
  isExpanded: boolean; 
  onToggle: () => void;
  providerBusinessName: string;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  async function changeStatus(
    newStatus: 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled',
    extra?: { checklist?: ChecklistItem[] },
  ) {
    setSubmitting(newStatus);
    try {
      const res = await fetch('/api/provider/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: b.id, status: newStatus, ...(extra ?? {}) }),
      });
      if (!res.ok) {
        throw new Error('Status transition failed');
      }
      toast.success(`Booking status updated to ${newStatus.replace('_', ' ')}!`);
    } catch (e) {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  // Format phone links
  const rawPhone = b.customer_phone_snapshot || '';
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
  const waLink = cleanPhone 
    ? `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(
        `Hello ${b.customer_name_snapshot || 'there'}, this is ${providerBusinessName} contacting you regarding your booking on SahuliatAI.`
      )}`
    : '';

  // Google Maps address search link
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.location_text)}`;

  return (
    <div className={`rounded-xl border transition-all duration-200 bg-card overflow-hidden ${
      isExpanded 
        ? 'border-primary/40 ring-1 ring-primary/10 shadow-md' 
        : 'border-border/80 hover:border-border hover:shadow-sm'
    }`}>
      {/* Header Row (Summary) */}
      <div 
        onClick={onToggle}
        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground">
              {b.customer_name_snapshot || 'Customer'}
            </h3>
            <span className="text-xs text-muted-foreground font-normal">·</span>
            <span className="text-xs text-muted-foreground capitalize">
              {b.service_category.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground/70" />
            <span>{new Date(b.slot_start).toLocaleDateString()} at {new Date(b.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={b.status} />
          {isExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground/80" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground/80" />
          )}
        </div>
      </div>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/60 bg-muted/5 dark:bg-muted/10 pt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            {/* Left side info */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1">
                  <span className="font-semibold text-foreground/80">Location Details</span>
                  <p className="text-muted-foreground leading-relaxed">{b.location_text}</p>
                  <a 
                    href={mapsSearchUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold mt-1"
                  >
                    Open in Google Maps
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {b.notes && String(b.notes).trim().length > 0 && (
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="size-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-semibold text-foreground/80">Problem Notes</span>
                    <p className="text-muted-foreground italic leading-relaxed mt-0.5">"{b.notes}"</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right side contact & metadata */}
            <div className="space-y-3 border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-4">
              <span className="font-semibold text-foreground/85 block mb-1">Customer Contact</span>
              
              <div className="flex items-center gap-2">
                {rawPhone ? (
                  <>
                    <a 
                      href={`tel:${cleanPhone}`}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:bg-accent font-semibold text-foreground"
                    >
                      <Phone className="size-3.5" />
                      Call
                    </a>
                    {waLink && (
                      <a 
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 hover:bg-emerald-100/50 font-semibold"
                      >
                        <MessageSquare className="size-3.5" />
                        WhatsApp
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic">No phone number provided.</p>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1 pt-2">
                <p>Booking ID: <span className="font-mono text-[10px] select-all">{b.id}</span></p>
                <p>Status: <span className="capitalize">{b.status.replace('_', ' ')}</span></p>
                {b.invitation_channel && <p>Channel: <span className="capitalize">{b.invitation_channel}</span></p>}
              </div>
            </div>
          </div>

          {/* Action Row */}
          {['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status) && (
            <div className="pt-3 border-t border-border/40 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => changeStatus('cancelled')}
                disabled={submitting !== null}
                className="rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <XCircle className="size-3.5" />
                {submitting === 'cancelled' ? 'Cancelling...' : 'Cancel Job'}
              </button>

              {['confirmed', 'reminded'].includes(b.status) && (
                <button
                  onClick={() => changeStatus('en_route')}
                  disabled={submitting !== null}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Truck className="size-3.5" />
                  {submitting === 'en_route' ? 'Updating…' : 'On the way'}
                </button>
              )}

              {b.status === 'en_route' && (
                <button
                  onClick={() => changeStatus('arrived')}
                  disabled={submitting !== null}
                  className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <MapPinCheck className="size-3.5" />
                  {submitting === 'arrived' ? 'Updating…' : 'Arrived'}
                </button>
              )}

              {['arrived', 'confirmed', 'reminded'].includes(b.status) && (
                <button
                  onClick={() => changeStatus('in_progress')}
                  disabled={submitting !== null}
                  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-1.5 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <Play className="size-3.5" />
                  {submitting === 'in_progress' ? 'Starting...' : 'Start Job'}
                </button>
              )}

              {b.status === 'in_progress' && (
                <button
                  onClick={() => setCompleteModalOpen(true)}
                  disabled={submitting !== null}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle className="size-3.5" />
                  {submitting === 'completed' ? 'Completing...' : 'Mark Completed'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <CompleteJobModal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        bookingId={b.id}
        defaultChecklist={b.service_checklist ?? checklistFor(b.service_category)}
        onConfirm={async (checklist) => {
          await changeStatus('completed', { checklist });
          setCompleteModalOpen(false);
        }}
      />
    </div>
  );
}

function CompleteJobModal({
  open, onClose, bookingId, defaultChecklist, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  defaultChecklist: ChecklistItem[];
  onConfirm: (checklist: ChecklistItem[]) => Promise<void>;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(defaultChecklist);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => { setItems(defaultChecklist); }, [defaultChecklist]);

  if (!open) return null;
  const allDone = items.every((i) => i.done);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedPhotos.length >= 5) { toast.error('Maximum 5 photos allowed.'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/bookings/${bookingId}/evidence`, { method: 'POST', body: form });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed');
      setUploadedPhotos((prev) => [...prev, data.url!]);
      toast.success('Photo uploaded.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-xl overflow-y-auto max-h-[90dvh]">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-base">Confirm completion</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Tick off the checklist before marking this job complete. Customer will be asked to rate after this step.
          </p>
        </div>
        <div className="p-5 space-y-2">
          {items.map((item, idx) => (
            <label key={item.key} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, done: e.target.checked };
                  setItems(next);
                }}
                className="size-4 mt-0.5"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>

        {/* Photo evidence section */}
        <div className="px-5 pb-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Photo Evidence (optional, max 5)
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadedPhotos.map((url, i) => (
              <div key={i} className="size-14 rounded-md overflow-hidden border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {uploadedPhotos.length < 5 && (
              <label className={`size-14 rounded-md border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="text-2xl text-muted-foreground">{uploading ? '…' : '+'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background hover:bg-accent text-xs font-semibold px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            disabled={!allDone || pending}
            onClick={async () => {
              setPending(true);
              try { await onConfirm(items); } finally { setPending(false); }
            }}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50 flex items-center gap-1"
          >
            <CheckCircle className="size-3.5" />
            {pending ? 'Marking…' : allDone ? 'Mark complete' : 'Tick all items first'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useCountdown(sentAt: string): string {
  const sentMs = new Date(sentAt).getTime();
  const [now, setNow] = useState(sentMs);
  
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const expiresAt = sentMs + 15 * 60 * 1000;
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  
  if (remaining === 0) return 'expired';
  
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
