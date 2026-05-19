'use client';
import { useState } from 'react';
import { toast } from 'sonner';

interface Statement { role: 'customer' | 'provider'; message: string; at: string }
interface Resolution {
  refund_percent: number;
  compensation_credit_pkr: number;
  provider_message_en: string;
  blacklist_provider: boolean;
}
interface Dispute {
  id: string;
  kind: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  opened_at: string;
  statements: Statement[];
  resolution: Resolution | null;
  booking_id: string;
  bookings: { customer_name_snapshot: string | null; service_category: string; slot_start: string; location_text: string };
}

export default function ProviderDisputeInbox({ initialDisputes }: { initialDisputes: Dispute[] }) {
  const [disputes, setDisputes] = useState(initialDisputes);
  const open = disputes.filter((d) => d.status === 'open' || d.status === 'under_review');
  const closed = disputes.filter((d) => d.status === 'resolved' || d.status === 'escalated');

  function patch(id: string, next: Partial<Dispute>) {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, ...next } : d)));
  }

  return (
    <div className="space-y-6">
      <Section title={`Awaiting your response (${open.length})`}>
        {open.length === 0
          ? <Empty text="No active disputes. ★" />
          : <div className="space-y-3">{open.map((d) => <DisputeCard key={d.id} d={d} onUpdate={patch} />)}</div>
        }
      </Section>
      <Section title={`History (${closed.length})`}>
        {closed.length === 0
          ? <Empty text="No past disputes." />
          : <div className="space-y-3">{closed.map((d) => <DisputeCard key={d.id} d={d} onUpdate={patch} />)}</div>
        }
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-base font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground italic py-4 text-center">{text}</p>;
}

function DisputeCard({ d, onUpdate }: { d: Dispute; onUpdate: (id: string, n: Partial<Dispute>) => void }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [acknowledged, setAcknowledged] = useState<null | boolean>(null);
  const [pending, setPending] = useState(false);
  const canRespond = d.status === 'open' || d.status === 'under_review';

  async function submit() {
    if (acknowledged === null) { toast.error('Choose acknowledge or dispute first.'); return; }
    if (statement.trim().length < 5) { toast.error('Please explain your side.'); return; }
    setPending(true);
    try {
      const res = await fetch(`/api/disputes/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged, statement: statement.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { status, resolution } = (await res.json()) as { status: Dispute['status']; resolution: Resolution };
      onUpdate(d.id, { status, resolution });
      toast.success('Response submitted.');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to submit.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-4 text-left flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{d.kind.replace('_', ' ')} · {d.bookings.customer_name_snapshot || 'Customer'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {d.bookings.service_category.replace('_', ' ')} · filed {new Date(d.opened_at).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={d.status} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-2">
            {d.statements.map((s, i) => (
              <div key={i} className={`rounded-md border p-2.5 text-sm ${s.role === 'customer' ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/10' : 'border-border bg-card'}`}>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{s.role}</p>
                <p className="whitespace-pre-wrap">{s.message}</p>
              </div>
            ))}
          </div>
          {d.resolution && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 p-3 text-sm">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Resolution</p>
              <p>{d.resolution.provider_message_en}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Refund: {d.resolution.refund_percent}% · Credit issued: PKR {d.resolution.compensation_credit_pkr}
                {d.resolution.blacklist_provider && ' · Account restricted'}
              </p>
            </div>
          )}
          {canRespond && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setAcknowledged(true)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${acknowledged === true ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 font-medium' : 'border-border bg-card hover:bg-accent'}`}
                >
                  Acknowledge the issue
                </button>
                <button
                  onClick={() => setAcknowledged(false)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${acknowledged === false ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20 font-medium' : 'border-border bg-card hover:bg-accent'}`}
                >
                  Dispute the claim
                </button>
              </div>
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={3}
                placeholder="Explain your side of the story…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button onClick={submit} disabled={pending}
                className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                {pending ? 'Submitting…' : 'Submit response'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Dispute['status'] }) {
  const color = {
    open: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    escalated: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  }[status];
  return (
    <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded-full ${color}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
