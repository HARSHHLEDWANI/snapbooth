/**
 * Single source of truth for brand + tuning constants.
 * Rename the whole app by changing APP_NAME.
 */
export const APP_NAME = 'twoplace';
export const APP_TAGLINE = 'a tiny pastel world you visit together';

/** The privacy promise — shown in the footer, kept true by the code. */
export const PRIVACY_PROMISE =
  'your photos never touch a server — everything stays on your devices';

/** Pastel palette — mirrored in globals.css as CSS variables. */
export const PALETTE = {
  cream: '#FFF8F0',
  blush: '#FFD6E0',
  pink: '#FF8FAB',
  butter: '#FFE8A3',
  sky: '#BDE0FE',
  brown: '#6B4F4F',
  white: '#FFFFFF',
  black: '#2B2320',
} as const;

/** Partner accent colors — each person picks one per session (never stored).
 *  Used on duo feed borders, cursors, and activity UI. */
export const ACCENTS = [
  { id: 'pink', label: 'pink', value: '#FF8FAB', soft: '#FFD6E0' },
  { id: 'blue', label: 'blue', value: '#7FB5F0', soft: '#BDE0FE' },
  { id: 'butter', label: 'butter', value: '#F0C060', soft: '#FFE8A3' },
  { id: 'mint', label: 'mint', value: '#7ED0A8', soft: '#C8F0DC' },
  { id: 'lilac', label: 'lilac', value: '#B79CED', soft: '#E2D6FF' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];
export const accentById = (id: string) =>
  ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

/** Ordered swatches offered in the edit "frame" tab. */
export const FRAME_COLORS = [
  { id: 'cream', label: 'cream', value: PALETTE.cream },
  { id: 'blush', label: 'blush', value: PALETTE.blush },
  { id: 'pink', label: 'pink', value: PALETTE.pink },
  { id: 'butter', label: 'butter', value: PALETTE.butter },
  { id: 'sky', label: 'sky', value: PALETTE.sky },
  { id: 'brown', label: 'mocha', value: PALETTE.brown },
  { id: 'white', label: 'white', value: PALETTE.white },
  { id: 'black', label: 'black', value: PALETTE.black },
  { id: 'checkered', label: 'checker', value: 'pattern:checkered' },
  { id: 'gingham', label: 'gingham', value: 'pattern:gingham' },
] as const;

/** Client-side rate limit for EmailJS sends (ms). Tracked in memory only. */
export const EMAIL_RATE_LIMIT_MS = 30_000;
/** Print-quality target width for exported strip (px, before 2x). */
export const STRIP_EXPORT_WIDTH = 1200;

/**
 * localStorage keys. DEVICE PREFERENCES ONLY — never personal data.
 * (No names, no photos, no history, no addresses. That's the whole point.)
 */
export const LS_KEYS = {
  muted: 'twoplace:muted',
  mirror: 'twoplace:mirror',
  liteMode: 'twoplace:lite',
} as const;
