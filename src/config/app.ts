/**
 * Single source of truth for brand + tuning constants.
 * Rename the whole app by changing APP_NAME.
 */
export const APP_NAME = 'snapbooth';
export const APP_TAGLINE = 'your pastel dream photobooth';

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

/** Client-side rate limit for EmailJS sends (ms). */
export const EMAIL_RATE_LIMIT_MS = 30_000;
/** Max recent strips kept in localStorage. */
export const RECENT_STRIPS_MAX = 6;
/** Print-quality target width for exported strip (px, before 2x). */
export const STRIP_EXPORT_WIDTH = 1200;

export const LS_KEYS = {
  name: 'snapbooth:name',
  muted: 'snapbooth:muted',
  mirror: 'snapbooth:mirror',
  liteMode: 'snapbooth:lite',
  recentStrips: 'snapbooth:recentStrips',
  lastEmailAt: 'snapbooth:lastEmailAt',
} as const;
