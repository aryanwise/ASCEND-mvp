import type { AreaId } from '@/types';

export const AREAS: Record<AreaId, { label: string; emoji: string; color: string; soft: string }> = {
  fitness: { label: 'Fitness', emoji: '💪', color: '#1B7A5C', soft: '#D9F0E5' },
  study:   { label: 'Study',   emoji: '📚', color: '#3D4D8A', soft: '#E8EBF8' },
  career:  { label: 'Career',  emoji: '💼', color: '#7B4FBF', soft: '#EFE8FA' },
  diet:    { label: 'Diet',    emoji: '🥗', color: '#B8721C', soft: '#F8E6CB' },
  mind:    { label: 'Mind',    emoji: '🧠', color: '#1B6B7A', soft: '#D9EEF0' },
  money:   { label: 'Money',   emoji: '💰', color: '#2E7D32', soft: '#D9F0DB' },
  health:  { label: 'Health',  emoji: '❤️', color: '#C62828', soft: '#FDDEDE' },
  habits:  { label: 'Habits',  emoji: '✨', color: '#D9531E', soft: '#FFE9DD' },
  custom:  { label: 'Custom',  emoji: '🎯', color: '#6B6359', soft: '#EBE5D6' },
};

export const area = (id: string) => AREAS[id as AreaId] ?? AREAS.custom;
