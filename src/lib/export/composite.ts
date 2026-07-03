/**
 * composite.ts — draws the final photo strip to a canvas. The SAME function
 * powers the on-screen edit preview and the high-res export, guaranteeing the
 * download is pixel-identical to what the user sees (just at a different scale).
 */
import type { EditState, Shot, StripLayout } from '@/store/useBoothStore';
import { renderFilteredToCanvas, loadImage } from '@/lib/capture/frameGrab';
import { stickerDataUrl, getSticker } from '@/lib/stickers';
import { APP_NAME } from '@/config/app';

interface Cell { x: number; y: number; w: number; h: number }
interface LayoutDef {
  aspect: number; // strip height / width of the PHOTO area
  count: number;
  cells: Cell[]; // normalized within photo area
}

const GAP = 0.03;

function makeLayout(layout: StripLayout): LayoutDef {
  switch (layout) {
    case '4x1': {
      const cells: Cell[] = [];
      const ch = (1 - GAP * 3) / 4;
      for (let i = 0; i < 4; i++) cells.push({ x: 0, y: i * (ch + GAP), w: 1, h: ch });
      return { aspect: 3.1, count: 4, cells };
    }
    case '3x1': {
      const cells: Cell[] = [];
      const ch = (1 - GAP * 2) / 3;
      for (let i = 0; i < 3; i++) cells.push({ x: 0, y: i * (ch + GAP), w: 1, h: ch });
      return { aspect: 2.35, count: 3, cells };
    }
    case '2x2': {
      const cw = (1 - GAP) / 2;
      const ch = (1 - GAP) / 2;
      return {
        aspect: 1.0,
        count: 4,
        cells: [
          { x: 0, y: 0, w: cw, h: ch },
          { x: cw + GAP, y: 0, w: cw, h: ch },
          { x: 0, y: ch + GAP, w: cw, h: ch },
          { x: cw + GAP, y: ch + GAP, w: cw, h: ch },
        ],
      };
    }
    case 'featured': {
      const bigH = 0.62;
      const smallH = 1 - bigH - GAP;
      const sw = (1 - GAP * 2) / 3;
      return {
        aspect: 1.15,
        count: 4,
        cells: [
          { x: 0, y: 0, w: 1, h: bigH },
          { x: 0, y: bigH + GAP, w: sw, h: smallH },
          { x: sw + GAP, y: bigH + GAP, w: sw, h: smallH },
          { x: (sw + GAP) * 2, y: bigH + GAP, w: sw, h: smallH },
        ],
      };
    }
    case 'polaroid':
    default:
      return { aspect: 1.0, count: 1, cells: [{ x: 0, y: 0, w: 1, h: 1 }] };
  }
}

export const layoutShotCount = (l: StripLayout) => makeLayout(l).count;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number, iw: number, ih: number, radius: number) {
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.save();
  roundRect(ctx, dx, dy, dw, dh, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function paintFrame(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
  if (color === 'pattern:checkered') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const s = w / 10;
    ctx.fillStyle = '#FFD6E0';
    for (let y = 0; y * s < h; y++)
      for (let x = 0; x * s < w; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * s, y * s, s, s);
  } else if (color === 'pattern:gingham') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const s = w / 16;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#BDE0FE';
    for (let x = 0; x * s < w; x++) ctx.fillRect(x * s, 0, s / 2, h);
    for (let y = 0; y * s < h; y++) ctx.fillRect(0, y * s, w, s / 2);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
}

export interface CompositeOptions {
  width: number; // css/base width of the strip
  scale?: number; // export scale (e.g. 2)
  date?: Date;
}

/** Render the strip. Returns a canvas at width*scale. */
export async function compositeStrip(
  shots: Shot[],
  edit: EditState,
  opts: CompositeOptions,
): Promise<HTMLCanvasElement> {
  const scale = opts.scale ?? 1;
  const W = Math.round(opts.width * scale);
  const def = makeLayout(edit.layout);

  const pad = Math.round(W * 0.055);
  const photoW = W - pad * 2;
  const photoAreaH = photoW * def.aspect;

  const isPolaroid = edit.layout === 'polaroid';
  const captionH = Math.round(W * (isPolaroid ? 0.18 : 0.11));
  const H = pad + photoAreaH + captionH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.round(H);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  // frame background
  paintFrame(ctx, edit.frameColor, W, canvas.height);

  const radius = edit.corners === 'rounded' ? W * 0.03 : 0;

  // pre-render each needed shot through the filter+adjust
  const needed = def.count;
  const rendered: HTMLCanvasElement[] = [];
  for (let i = 0; i < needed; i++) {
    const shot = shots[i % Math.max(shots.length, 1)];
    if (!shot) {
      const blank = document.createElement('canvas');
      blank.width = 4; blank.height = 4;
      rendered.push(blank);
      continue;
    }
    const c = await renderFilteredToCanvas(shot.sourceDataURL, {
      filterId: edit.filterId,
      adjust: edit.adjust,
      mirror: false,
    });
    rendered.push(c);
  }

  // draw photos into cells
  def.cells.forEach((cell, i) => {
    const img = rendered[i];
    const dx = pad + cell.x * photoW;
    const dy = pad + cell.y * photoAreaH;
    const dw = cell.w * photoW;
    const dh = cell.h * photoAreaH;
    // subtle white matte behind each photo for the print look
    ctx.save();
    roundRect(ctx, dx, dy, dw, dh, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(107,79,79,0.18)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3 * scale;
    ctx.shadowOffsetY = 3 * scale;
    ctx.fill();
    ctx.restore();
    drawCover(ctx, img, dx, dy, dw, dh, img.width, img.height, radius);
  });

  // caption / date / footer
  const cx = W / 2;
  let ty = pad + photoAreaH + captionH * 0.42;
  const inkDark = edit.frameColor === '#2B2320' || edit.frameColor === '#6B4F4F';
  ctx.fillStyle = inkDark ? '#FFF8F0' : '#6B4F4F';
  ctx.textAlign = 'center';

  const caption = edit.caption.trim();
  if (caption) {
    ctx.font = `700 ${Math.round(W * 0.06)}px 'Gochi Hand', 'Baloo 2', cursive`;
    ctx.fillText(caption, cx, ty);
    ty += captionH * 0.34;
  }
  if (edit.showDate) {
    const d = opts.date ?? new Date();
    const stamp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    ctx.font = `600 ${Math.round(W * 0.032)}px 'Quicksand', sans-serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(stamp, cx, caption ? ty : ty + captionH * 0.05);
    ctx.globalAlpha = 1;
  }
  if (edit.showFooter) {
    ctx.font = `700 ${Math.round(W * 0.028)}px 'Quicksand', sans-serif`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(`♡ ${APP_NAME}`, cx, canvas.height - pad * 0.5);
    ctx.globalAlpha = 1;
  }

  // stickers (drawn last, on top)
  const base = W * 0.16;
  for (const s of edit.stickers) {
    ctx.save();
    ctx.translate(s.x * W, s.y * canvas.height);
    ctx.rotate((s.rotation * Math.PI) / 180);
    const size = base * s.scale;
    if (s.kind === 'svg') {
      const def2 = getSticker(s.content);
      if (def2) {
        const img = await loadImage(stickerDataUrl(def2.svg));
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      }
    } else {
      ctx.font = `700 ${size * 0.6}px ${s.font || "'Gochi Hand', cursive"}`;
      ctx.fillStyle = s.color || '#FF8FAB';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = size * 0.05;
      ctx.strokeText(s.content, 0, 0);
      ctx.fillText(s.content, 0, 0);
    }
    ctx.restore();
  }

  return canvas;
}
