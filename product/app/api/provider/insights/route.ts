import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { data: providers } = await admin
    .from('providers')
    .select('id, base_visit_fee, base_hourly_rate, avg_duration')
    .eq('owner_user_id', user.id)
    .limit(1);

  if (!providers || providers.length === 0) return Response.json({ error: 'no provider' }, { status: 404 });
  const provider = providers[0];

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, status, slot_start, slot_end, price_estimate, service_category')
    .eq('provider_id', provider.id)
    .gte('slot_start', monthStart.toISOString());

  const all = bookings ?? [];
  const completed = all.filter((b) => b.status === 'completed');
  const weekCompleted = completed.filter((b) => new Date(b.slot_start) >= weekStart);

  // Earnings estimate: use price_estimate.total if available, else base_visit_fee + 1h rate
  const avgDurationH = parseIntervalToHours((provider.avg_duration as string | null) ?? '01:00:00');
  const fallbackEarning = Number(provider.base_visit_fee ?? 500) + Number(provider.base_hourly_rate ?? 800) * avgDurationH;

  function earningsFor(list: typeof completed) {
    return list.reduce((sum, b) => {
      const est = b.price_estimate as { total?: number } | null;
      return sum + (est?.total ?? fallbackEarning);
    }, 0);
  }

  const earningsWeek = earningsFor(weekCompleted);
  const earningsMonth = earningsFor(completed);

  // Utilization: completed / (completed + upcoming) this month
  const upcoming = all.filter((b) => ['confirmed', 'reminded', 'en_route', 'arrived', 'in_progress'].includes(b.status));
  const totalServiced = completed.length + upcoming.length;
  const utilizationPct = totalServiced > 0 ? Math.round((completed.length / totalServiced) * 100) : 0;

  // Best slots: count completed bookings per hour of day (Asia/Karachi)
  const hourCounts: Record<number, number> = {};
  for (const b of completed) {
    const h = new Date(b.slot_start).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false });
    const hour = parseInt(h, 10);
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
  }
  const sortedHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([h, count]) => ({
      hour: parseInt(h, 10),
      label: new Date(0, 0, 0, parseInt(h, 10)).toLocaleString('en-PK', { hour: 'numeric', hour12: true }),
      bookings: count,
    }));

  // Category breakdown this month
  const catCounts: Record<string, number> = {};
  for (const b of all) {
    const c = b.service_category as string;
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([slug, count]) => ({ slug, count }));

  return Response.json({
    earnings: { week: Math.round(earningsWeek), month: Math.round(earningsMonth), currency: 'PKR' },
    utilization: { pct: utilizationPct, completed: completed.length, total: totalServiced },
    best_slots: sortedHours,
    top_categories: topCategories,
    upcoming_count: upcoming.length,
    completed_this_month: completed.length,
  });
}

function parseIntervalToHours(s: string): number {
  const colon = s.match(/^(\d+):(\d+):(\d+)$/);
  if (colon) return parseInt(colon[1], 10) + parseInt(colon[2], 10) / 60;
  const hh = s.match(/(\d+)\s*hour/i);
  const mm = s.match(/(\d+)\s*minute/i);
  return ((hh ? parseInt(hh[1], 10) : 0) + (mm ? parseInt(mm[1], 10) / 60 : 0)) || 1;
}
