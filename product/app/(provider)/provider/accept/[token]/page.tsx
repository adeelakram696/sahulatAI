import { admin } from '@/lib/supabase/admin';
import AcceptForm from '@/components/provider/accept-form';

interface BookingForAccept {
  id: string;
  status: string;
  slot_start: string;
  slot_end: string;
  service_category: string;
  location_text: string;
  invitation_sent_at: string;
  customer_name_snapshot: string | null;
  providers: { business_name: string } | { business_name: string }[] | null;
}

export default async function AcceptTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, slot_start, slot_end, service_category, location_text, invitation_sent_at, customer_name_snapshot, providers(business_name)')
    .eq('invitation_token', token)
    .maybeSingle<BookingForAccept>();

  if (!booking) {
    return <SimpleMessage title="Invitation not found" body="This link is invalid or has expired." />;
  }
  const prov = Array.isArray(booking.providers) ? booking.providers[0] : booking.providers;

  if (booking.status === 'confirmed') {
    return <SimpleMessage title={`Already accepted`} body={`You've already confirmed this booking with ${prov?.business_name}.`} />;
  }
  if (booking.status !== 'invitation_sent') {
    return <SimpleMessage title="This invitation is no longer active" body={`Current status: ${booking.status}.`} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="mb-4">
          <p className="text-xs text-muted-foreground">SahuliatAI</p>
          <h1 className="text-xl font-bold mt-1">New booking for {prov?.business_name}</h1>
        </header>

        <dl className="space-y-3 mb-6 text-sm">
          <Row label="Service" value={booking.service_category.replace('_', ' ')} />
          <Row label="When" value={new Date(booking.slot_start).toLocaleString()} />
          <Row label="Location" value={booking.location_text} />
          <Row label="Customer" value={booking.customer_name_snapshot || 'Customer'} />
        </dl>

        <AcceptForm token={token} />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function SimpleMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{body}</p>
      </div>
    </main>
  );
}
