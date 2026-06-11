// Central design tokens + area config used across all screens.

export const C = {
  orange: '#D9531E',
  orangeSoft: '#FFE9DD',
  dark: '#1A1815',
  bg: '#F8F5EF',
  muted: '#6B6359',
  faint: '#A8A095',
  border: 'rgba(26,24,21,0.08)',
  card: '#ffffff',
  sand: '#EBE5D6',
  desk: '#E8E2D6',
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
  habits:  { key: 'habits',  label: 'Habits',  color: '#D9531E', soft: '#FFE9DD', emoji: '✨' },
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
