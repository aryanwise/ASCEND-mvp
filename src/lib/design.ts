// Central design tokens + area config used across all screens.

export const C = {
  orange: 'var(--orange)',
  caramel: 'var(--caramel)',
  onAccent: 'var(--on-accent)',
  orangeSoft: 'var(--orange-soft)',
  dark: 'var(--dark)',
  bg: 'var(--bg)',
  muted: 'var(--muted)',
  faint: 'var(--faint)',
  border: 'var(--border)',
  card: 'var(--card)',
  sand: 'var(--sand)',
  desk: 'var(--desk)',
  ink: 'var(--ink)',
  onInk: 'var(--on-ink)',
  cardRaised: 'var(--card-raised)',
  cardBorder: 'var(--card-border)',
  accentText: 'var(--accent-text)',
  quote: 'var(--quote)',
} as const;

export const SERIF = 'Georgia, serif';
export const SANS = "-apple-system, 'Inter', system-ui, sans-serif";

export type AreaKey =
  | 'fitness' | 'study' | 'career' | 'diet'
  | 'mind' | 'money' | 'health' | 'habits' | 'custom';

export interface AreaDef { key: AreaKey; label: string; color: string; soft: string; emoji: string; }

export const AREAS: Record<AreaKey, AreaDef> = {
  fitness: { key: 'fitness', label: 'Fitness', color: 'var(--area-fitness)', soft: 'var(--area-fitness-soft)', emoji: '💪' },
  study:   { key: 'study',   label: 'Study',   color: 'var(--area-study)', soft: 'var(--area-study-soft)', emoji: '📚' },
  career:  { key: 'career',  label: 'Career',  color: 'var(--area-career)', soft: 'var(--area-career-soft)', emoji: '💼' },
  diet:    { key: 'diet',    label: 'Diet',    color: 'var(--area-diet)', soft: 'var(--area-diet-soft)', emoji: '🥗' },
  mind:    { key: 'mind',    label: 'Mind',    color: 'var(--area-mind)', soft: 'var(--area-mind-soft)', emoji: '🧠' },
  money:   { key: 'money',   label: 'Money',   color: 'var(--area-money)', soft: 'var(--area-money-soft)', emoji: '💰' },
  health:  { key: 'health',  label: 'Health',  color: 'var(--area-health)', soft: 'var(--area-health-soft)', emoji: '❤️' },
  habits:  { key: 'habits',  label: 'Habits',  color: 'var(--area-habits)', soft: 'var(--area-habits-soft)', emoji: '✨' },
  custom:  { key: 'custom',  label: 'Custom',  color: 'var(--area-custom)', soft: 'var(--area-custom-soft)', emoji: '🎯' },
};

export const AREA_LIST: AreaDef[] = Object.values(AREAS);

export function area(key: string): AreaDef {
  return AREAS[(key as AreaKey)] ?? AREAS.custom;
}

export const ARCHETYPES = [
  { key: 'rigid_9to5',    title: 'The 9-to-5',     desc: 'Structured work, free evenings' },
  { key: 'nocturnal_dev', title: 'The Night Owl',  desc: 'Late nights, fluid hours, chaotic mornings' },
  { key: 'deep_worker',   title: 'The Deep Worker', desc: 'Large unstructured focus blocks' },
  { key: 'student',       title: 'The Student',    desc: 'Mixed schedule, deadlines drive everything' },
] as const;

export const QUOTES = [
  'Discipline is choosing what you want most over what you want now.',
  'You do not rise to your goals. You fall to your systems.',
  'Small steps, repeated, become unstoppable.',
  'The work you avoid is usually the work that matters.',
  'Consistency beats intensity. Show up.',
  'Progress, not perfection.',
  'Your future is built by what you do today.',
];

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Deterministic "quote of the day" — same all day, changes when the date changes.
export function dailyQuote(): string {
  const d = new Date();
  const dayNum = Math.floor(d.getTime() / 86400000);
  return QUOTES[dayNum % QUOTES.length];
}

// A different random quote (for tap-to-change), avoiding the one passed in.
export function nextQuote(current: string): string {
  if (QUOTES.length < 2) return QUOTES[0];
  let q = current;
  while (q === current) q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return q;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
