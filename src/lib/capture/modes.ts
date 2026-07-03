import type { CaptureMode } from '@/store/useBoothStore';

export interface ModeMeta {
  id: CaptureMode;
  label: string;
  hint: string;
  icon: string; // emoji-ish glyph for the dial
}

export const MODES: ModeMeta[] = [
  { id: 'classic', label: 'classic strip', hint: '4 shots · countdown', icon: '🎞️' },
  { id: 'single', label: 'single snap', hint: '1 shot · instant retake', icon: '📸' },
  { id: 'burst', label: 'burst', hint: '8 shots · pick 4', icon: '⚡' },
  { id: 'boomerang', label: 'boomerang', hint: '1.5s looping gif', icon: '🔁' },
  { id: 'smile', label: 'smile trigger', hint: 'hands-free · auto snap', icon: '😊' },
];

export const modeMeta = (id: CaptureMode) => MODES.find((m) => m.id === id)!;
