/**
 * daynight.ts — the street's lighting follows the visitor's local clock.
 * Pure delight, zero data: the hour is read live and never stored or sent.
 */

export type DayTheme = 'day' | 'dusk' | 'night';

export function currentTheme(date = new Date()): DayTheme {
  const h = date.getHours();
  if (h >= 7 && h < 17) return 'day';
  if ((h >= 17 && h < 20) || (h >= 5 && h < 7)) return 'dusk';
  return 'night';
}

export interface ThemeTokens {
  /** CSS gradient for the DOM sky behind the transparent canvas */
  skyCss: string;
  ambient: number;
  /** main (only) shadow light */
  sun: { color: string; intensity: number; position: [number, number, number] };
  hemi: [string, string, number];
  fog: string;
  ground: string;
  road: string;
  /** how hard neon/screens glow */
  emissive: number;
  stars: boolean;
}

export const THEMES: Record<DayTheme, ThemeTokens> = {
  day: {
    skyCss: 'linear-gradient(180deg, #bfe2ff 0%, #ffd9e6 55%, #fff0d4 100%)',
    ambient: 0.75,
    sun: { color: '#fff4e0', intensity: 1.15, position: [4, 7, 5] },
    hemi: ['#ffd6e0', '#fff8f0', 0.5],
    fog: '#ffd6e0',
    ground: '#ffe9da',
    road: '#f7d9e4',
    emissive: 0.35,
    stars: false,
  },
  dusk: {
    skyCss: 'linear-gradient(180deg, #9f8fd8 0%, #e8a7c8 55%, #ffd9b0 100%)',
    ambient: 0.5,
    sun: { color: '#ffb98a', intensity: 0.85, position: [-6, 3.5, 5] },
    hemi: ['#c8a7e8', '#e8c8b0', 0.45],
    fog: '#cba6d8',
    ground: '#e0c2cf',
    road: '#d3aec8',
    emissive: 0.8,
    stars: false,
  },
  night: {
    skyCss: 'linear-gradient(180deg, #262a55 0%, #56498a 55%, #8a6aa8 100%)',
    ambient: 0.3,
    sun: { color: '#bcd0ff', intensity: 0.5, position: [3, 8, 4] },
    hemi: ['#6a5aa8', '#3a3260', 0.4],
    fog: '#5c4d86',
    ground: '#5f5488',
    road: '#544a7c',
    emissive: 1.5,
    stars: true,
  },
};
