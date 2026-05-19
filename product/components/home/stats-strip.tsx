import { BadgeCheck, Timer, MapPin } from 'lucide-react';

type Stat = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: string;
  iconColor: string;
};

export default function StatsStrip({ providerCount }: { providerCount: number | null }) {
  const verifiedDisplay =
    providerCount && providerCount > 0
      ? providerCount >= 1000
        ? `${Math.floor(providerCount / 100) / 10}k+`
        : `${providerCount}+`
      : '—';

  const stats: Stat[] = [
    {
      value: verifiedDisplay,
      label: 'Verified pros',
      Icon: BadgeCheck,
      tint: 'bg-emerald-100 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      value: '~2 min',
      label: 'AI booking',
      Icon: Timer,
      tint: 'bg-sky-100 dark:bg-sky-950/40',
      iconColor: 'text-sky-600 dark:text-sky-400',
    },
    {
      value: '16',
      label: 'Service types',
      Icon: MapPin,
      tint: 'bg-violet-100 dark:bg-violet-950/40',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
  ];

  return (
    <ul role="list" className="grid grid-cols-3 gap-2 sm:gap-3 rounded-2xl border border-border/60 bg-card p-2 sm:p-3 shadow-xs">
      {stats.map(({ value, label, Icon, tint, iconColor }) => (
        <li
          key={label}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center"
        >
          <span className={`inline-flex size-8 items-center justify-center rounded-full ${tint}`}>
            <Icon className={`size-4 ${iconColor}`} strokeWidth={2} />
          </span>
          <span className="font-display font-bold text-[15px] leading-none tracking-tight text-foreground">
            {value}
          </span>
          <span className="text-[10.5px] font-medium text-muted-foreground leading-none">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
