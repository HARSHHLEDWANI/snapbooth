'use client';

/**
 * images.ts — random pictures from the internet, no keys required.
 *
 * Primary source is loremflickr (keyword-tagged randoms, `lock` pins a seed to
 * a stable picture); fallback is picsum (pretty but keyword-blind). If an
 * Unsplash key exists we prefer their API for better category accuracy and
 * silently skip it otherwise.
 *
 * SYNC RULE (the whole point): in any room game the HOST resolves the final
 * URL list and broadcasts it over the data channel, so both people are
 * guaranteed to be looking at the exact same pictures. Guests never generate
 * their own URLs.
 */

export interface ImageCategory {
  id: string;
  emoji: string;
  label: string;
  /** loremflickr / unsplash search keyword(s) */
  keyword: string;
  /** playful prompt used by "who'd pick this?" and image roulette */
  prompt: string;
}

/** Add a category = add one line here. */
export const IMAGE_CATEGORIES: ImageCategory[] = [
  { id: 'houses', emoji: '🏠', label: 'houses', keyword: 'house,architecture', prompt: 'which house would they pick?' },
  { id: 'puppies', emoji: '🐶', label: 'puppies', keyword: 'puppy,dog', prompt: 'which pup would they take home?' },
  { id: 'kittens', emoji: '🐱', label: 'kittens', keyword: 'kitten,cat', prompt: 'which kitten is so them?' },
  { id: 'cars', emoji: '🚗', label: 'cars', keyword: 'car,classiccar', prompt: 'which car would they drive off in?' },
  { id: 'vacations', emoji: '🏝️', label: 'vacation spots', keyword: 'beach,travel', prompt: 'where would they escape to?' },
  { id: 'desserts', emoji: '🍰', label: 'desserts', keyword: 'dessert,cake', prompt: 'which dessert would they order?' },
  { id: 'apartments', emoji: '🛋️', label: 'apartments', keyword: 'interior,livingroom', prompt: 'which place would they move into?' },
  { id: 'weddingcakes', emoji: '💒', label: 'wedding cakes', keyword: 'weddingcake', prompt: 'which cake says "them"?' },
  { id: 'gardens', emoji: '🌷', label: 'gardens', keyword: 'garden,flowers', prompt: 'which garden would they nap in?' },
  { id: 'coffee', emoji: '☕', label: 'cafés', keyword: 'coffee,cafe', prompt: 'which café is their vibe?' },
];

export const categoryById = (id: string) =>
  IMAGE_CATEGORIES.find((c) => c.id === id) ?? IMAGE_CATEGORIES[0];

const W = 800;
const H = 600;

export const makeSeed = () => Math.floor(Math.random() * 1_000_000_000);

export const loremflickrUrl = (keyword: string, seed: number, w = W, h = H) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keyword)}?lock=${seed}`;

export const picsumUrl = (seed: number | string, w = W, h = H) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** Best-effort Unsplash (only if a key is configured). Throws on any problem. */
async function unsplashImages(keyword: string, count: number, key: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(keyword)}&count=${count}&orientation=landscape&client_id=${key}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`unsplash ${res.status}`);
    const data = (await res.json()) as { urls: { regular: string } }[];
    if (!Array.isArray(data) || data.length < count) throw new Error('unsplash short');
    return data.slice(0, count).map((p) => p.urls.regular);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve `count` random image URLs for a category. HOST-ONLY in room games —
 * broadcast the result so both screens match. Never rejects: worst case it
 * returns picsum URLs.
 */
export async function getRandomImages(categoryId: string, count: number): Promise<string[]> {
  const cat = categoryById(categoryId);
  const key = process.env.NEXT_PUBLIC_UNSPLASH_KEY;
  if (key) {
    try { return await unsplashImages(cat.keyword, count, key); } catch { /* fall through */ }
  }
  return Array.from({ length: count }, () => loremflickrUrl(cat.keyword, makeSeed()));
}

/** Warm the browser cache for the next round while the current one plays. */
export function preloadImages(urls: string[]) {
  urls.forEach((u) => { const img = new Image(); img.src = u; });
}

/**
 * Load an image with CORS enabled so it can be drawn to an exportable canvas
 * (loremflickr and picsum both send permissive CORS headers). Resolves null
 * instead of rejecting — collages draw a pastel placeholder for misses.
 */
export function loadCorsImage(url: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}
