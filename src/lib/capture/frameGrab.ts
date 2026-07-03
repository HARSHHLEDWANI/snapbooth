/**
 * frameGrab.ts — turning live video / stored frames into images.
 *
 * Captures store the RAW webcam frame (no filter). Filters are re-applied on
 * demand via a shared offscreen FilterRenderer, so:
 *   • the captured still is a clean full-resolution frame, and
 *   • the edit screen can override the filter without re-shooting.
 */

import { FilterRenderer } from '@/lib/shaders/FilterRenderer';
import { filterIndex, type FilterId, type AdjustState, NEUTRAL_ADJUST } from '@/lib/shaders/filters';

export interface RawFrame {
  dataURL: string;
  width: number;
  height: number;
}

/** Draw the current video frame to a 2D canvas at native res (mirror optional). */
export function grabRawFrame(video: HTMLVideoElement, mirror: boolean): RawFrame {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  return { dataURL: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h };
}

// ── shared offscreen renderer for filtered stills (edit + filmstrip) ──
let sharedRenderer: FilterRenderer | null = null;
function getRenderer(): FilterRenderer {
  if (!sharedRenderer) sharedRenderer = new FilterRenderer();
  return sharedRenderer;
}

const imgCache = new Map<string, HTMLImageElement>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export interface FilteredOptions {
  filterId: FilterId;
  mirror?: boolean; // frames already mirror-baked; keep false to avoid double-flip
  adjust?: AdjustState;
  time?: number;
}

/** Render a stored raw image through a filter, returning a canvas (for compositing). */
export async function renderFilteredToCanvas(
  src: string,
  opts: FilteredOptions,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const r = getRenderer();
  r.render(img, {
    filterIndex: filterIndex(opts.filterId),
    mirror: opts.mirror ?? false,
    adjust: opts.adjust ?? NEUTRAL_ADJUST,
    time: opts.time ?? 0,
  });
  // copy out of the shared GL canvas into a 2D canvas we own
  const out = document.createElement('canvas');
  out.width = r.canvas.width;
  out.height = r.canvas.height;
  out.getContext('2d')!.drawImage(r.canvas, 0, 0);
  return out;
}

export async function renderFilteredToDataURL(
  src: string,
  opts: FilteredOptions,
): Promise<string> {
  const c = await renderFilteredToCanvas(src, opts);
  return c.toDataURL('image/jpeg', 0.9);
}
