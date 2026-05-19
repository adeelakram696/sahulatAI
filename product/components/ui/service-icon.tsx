import {
  IconAirConditioning,
  IconDroplet,
  IconBolt,
  IconVacuumCleaner,
  IconBooks,
  IconScissors,
  IconHammer,
  IconCar,
  IconTool,
  IconDeviceMobile,
  IconChefHat,
  IconBrush,
  IconBuildingFactory,
  IconWashMachine,
  IconLeaf,
  IconBug,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

type IconConfig = {
  icon: TablerIcon;
  bg: string;
  color: string;
};

const ICON_MAP: Record<string, IconConfig> = {
  ac_repair:        { icon: IconAirConditioning, bg: 'bg-sky-100 dark:bg-sky-950/50',       color: 'text-sky-600 dark:text-sky-400' },
  plumber:          { icon: IconDroplet,          bg: 'bg-blue-100 dark:bg-blue-950/50',      color: 'text-blue-600 dark:text-blue-400' },
  electrician:      { icon: IconBolt,             bg: 'bg-amber-100 dark:bg-amber-950/50',    color: 'text-amber-500 dark:text-amber-400' },
  house_cleaning:   { icon: IconVacuumCleaner,    bg: 'bg-teal-100 dark:bg-teal-950/50',      color: 'text-teal-600 dark:text-teal-400' },
  tutor:            { icon: IconBooks,            bg: 'bg-violet-100 dark:bg-violet-950/50',  color: 'text-violet-600 dark:text-violet-400' },
  beautician:       { icon: IconScissors,         bg: 'bg-pink-100 dark:bg-pink-950/50',      color: 'text-pink-600 dark:text-pink-400' },
  carpenter:        { icon: IconHammer,           bg: 'bg-orange-100 dark:bg-orange-950/50',  color: 'text-orange-600 dark:text-orange-400' },
  car_wash:         { icon: IconCar,              bg: 'bg-cyan-100 dark:bg-cyan-950/50',      color: 'text-cyan-600 dark:text-cyan-400' },
  car_mechanic:     { icon: IconTool,             bg: 'bg-slate-100 dark:bg-slate-800',       color: 'text-slate-600 dark:text-slate-300' },
  mobile_repair:    { icon: IconDeviceMobile,     bg: 'bg-indigo-100 dark:bg-indigo-950/50',  color: 'text-indigo-600 dark:text-indigo-400' },
  cook:             { icon: IconChefHat,          bg: 'bg-red-100 dark:bg-red-950/50',        color: 'text-red-600 dark:text-red-400' },
  painter:          { icon: IconBrush,            bg: 'bg-purple-100 dark:bg-purple-950/50',  color: 'text-purple-600 dark:text-purple-400' },
  mason:            { icon: IconBuildingFactory,  bg: 'bg-stone-100 dark:bg-stone-800',       color: 'text-stone-600 dark:text-stone-300' },
  appliance_repair: { icon: IconWashMachine,      bg: 'bg-gray-100 dark:bg-gray-800',         color: 'text-gray-600 dark:text-gray-300' },
  gardening:        { icon: IconLeaf,             bg: 'bg-green-100 dark:bg-green-950/50',    color: 'text-green-600 dark:text-green-400' },
  pest_control:     { icon: IconBug,              bg: 'bg-lime-100 dark:bg-lime-950/50',      color: 'text-lime-700 dark:text-lime-400' },
};

const FALLBACK: IconConfig = {
  icon: IconTool,
  bg: 'bg-muted',
  color: 'text-muted-foreground',
};

const SIZE = {
  sm:  { wrap: 'size-8  rounded-lg',  icon: 16 },
  md:  { wrap: 'size-10 rounded-xl',  icon: 20 },
  lg:  { wrap: 'size-14 rounded-2xl', icon: 28 },
  xl:  { wrap: 'size-16 rounded-2xl', icon: 32 },
} as const;

export function ServiceIcon({
  slug,
  size = 'md',
  className = '',
}: {
  slug: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const cfg = ICON_MAP[slug] ?? FALLBACK;
  const Icon = cfg.icon;
  const { wrap, icon: iconSize } = SIZE[size];

  return (
    <div className={`${wrap} ${cfg.bg} flex items-center justify-center shrink-0 ${className}`}>
      <Icon size={iconSize} className={cfg.color} stroke={1.75} />
    </div>
  );
}

export function serviceIconColor(slug: string): string {
  return (ICON_MAP[slug] ?? FALLBACK).color;
}
