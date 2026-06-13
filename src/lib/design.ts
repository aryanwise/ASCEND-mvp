// Central design tokens + area config used across all screens.

export const C = {
  orange: '#C0392B',
  caramel: '#DEAA6B',
  onAccent: '#FBF9F4', // cream text on the deep sienna accent
  orangeSoft: '#F7EFE0',
  dark: '#201E1A',
  bg: '#FBF9F4',
  muted: '#7A7366',
  faint: '#A89F8E',
  border: '#EFEAE0',
  card: '#ffffff',
  sand: '#F2ECE0',
  desk: '#EFE7D8',
} as const;

export const SERIF = 'Georgia, serif';
export const SANS = "-apple-system, 'Inter', system-ui, sans-serif";

export type AreaKey =
  | 'fitness' | 'study' | 'career' | 'diet'
  | 'mind' | 'money' | 'health' | 'habits' | 'custom';

export interface AreaDef { key: AreaKey; label: string; color: string; soft: string; emoji: string; }

export const AREAS: Record<AreaKey, AreaDef> = {
  fitness: { key: 'fitness', label: 'Fitness', color: '#1B7A5C', soft: '#D9F0E5', emoji: '💪' },
  study:   { key: 'study',   label: 'Study',   color: '#3D4D8A', soft: '#E8EBF8', emoji: '📚' },
  career:  { key: 'career',  label: 'Career',  color: '#7B4FBF', soft: '#EFE8FA', emoji: '💼' },
  diet:    { key: 'diet',    label: 'Diet',    color: '#B8721C', soft: '#F8E6CB', emoji: '🥗' },
  mind:    { key: 'mind',    label: 'Mind',    color: '#1B6B7A', soft: '#D9EEF0', emoji: '🧠' },
  money:   { key: 'money',   label: 'Money',   color: '#2E7D32', soft: '#D9F0DB', emoji: '💰' },
  health:  { key: 'health',  label: 'Health',  color: '#C62828', soft: '#FDDEDE', emoji: '❤️' },
  habits:  { key: 'habits',  label: 'Habits',  color: '#C0392B', soft: '#F7EFE0', emoji: '✨' },
  custom:  { key: 'custom',  label: 'Custom',  color: '#6B6359', soft: '#EBE5D6', emoji: '🎯' },
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
