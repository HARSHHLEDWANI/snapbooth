'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { getSticker, stickerDataUrl } from '@/lib/stickers';

/** DOM overlay of draggable / scalable / rotatable stickers (pointer + touch). */
export function StickerLayer({ width, height }: { width: number; height: number }) {
  const stickers = useBoothStore((s) => s.edit.stickers);
  const update = useBoothStore((s) => s.updateSticker);
  const remove = useBoothStore((s) => s.removeSticker);
  const [selected, setSelected] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const transform = useRef<{ id: string; cx: number; cy: number; startDist: number; startScale: number; startAng: number; startRot: number } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());

  const BASE = width * 0.16;

  // deselect when clicking empty space
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (layerRef.current && !layerRef.current.contains(e.target as Node)) setSelected(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  const onStickerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(id);
    const s = stickers.find((x) => x.id === id)!;
    const rect = layerRef.current!.getBoundingClientRect();
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = {
      id,
      dx: e.clientX - rect.left - s.x * width,
      dy: e.clientY - rect.top - s.y * height,
    };
  };

  const onHandleDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = stickers.find((x) => x.id === id)!;
    const rect = layerRef.current!.getBoundingClientRect();
    const cx = rect.left + s.x * width;
    const cy = rect.top + s.y * height;
    transform.current = {
      id,
      cx, cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy),
      startScale: s.scale,
      startAng: Math.atan2(e.clientY - cy, e.clientX - cx),
      startRot: s.rotation,
    };
  };

  const onMove = useCallback((e: React.PointerEvent) => {
    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // two-finger pinch scale
    if (pinch.current.size === 2 && drag.current) {
      const pts = [...pinch.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const t = transform.current;
      if (!t) {
        transform.current = { id: drag.current.id, cx: 0, cy: 0, startDist: dist, startScale: stickers.find((s) => s.id === drag.current!.id)?.scale ?? 1, startAng: 0, startRot: 0 };
      } else {
        update(t.id, { scale: Math.max(0.25, Math.min(4, t.startScale * (dist / t.startDist))) });
      }
      return;
    }

    if (transform.current) {
      const t = transform.current;
      const dist = Math.hypot(e.clientX - t.cx, e.clientY - t.cy);
      const ang = Math.atan2(e.clientY - t.cy, e.clientX - t.cx);
      update(t.id, {
        scale: Math.max(0.25, Math.min(4, t.startScale * (dist / t.startDist))),
        rotation: t.startRot + ((ang - t.startAng) * 180) / Math.PI,
      });
      return;
    }

    if (drag.current) {
      const rect = layerRef.current!.getBoundingClientRect();
      const nx = (e.clientX - rect.left - drag.current.dx) / width;
      const ny = (e.clientY - rect.top - drag.current.dy) / height;
      update(drag.current.id, { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) });
    }
  }, [stickers, update, width, height]);

  const onUp = (e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size < 2) {
      drag.current = null;
      transform.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent, id: string) => {
    e.stopPropagation();
    const s = stickers.find((x) => x.id === id)!;
    update(id, { scale: Math.max(0.25, Math.min(4, s.scale - Math.sign(e.deltaY) * 0.08)) });
  };

  return (
    <div
      ref={layerRef}
      className="sticker-layer"
      style={{ width, height }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {stickers.map((s) => {
        const size = BASE * s.scale;
        const sel = selected === s.id;
        const def = s.kind === 'svg' ? getSticker(s.content) : null;
        return (
          <div
            key={s.id}
            className={`sticker ${sel ? 'sel' : ''}`}
            style={{
              left: s.x * width,
              top: s.y * height,
              width: size,
              height: s.kind === 'text' ? 'auto' : size,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
            }}
            onPointerDown={(e) => onStickerDown(e, s.id)}
            onWheel={(e) => onWheel(e, s.id)}
          >
            {s.kind === 'svg' && def ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stickerDataUrl(def.svg)} alt={def.label} draggable={false} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
            ) : (
              <span
                style={{
                  fontFamily: s.font || "'Gochi Hand', cursive",
                  color: s.color || '#FF8FAB',
                  fontSize: size * 0.6,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  WebkitTextStroke: '1px rgba(255,255,255,0.9)',
                  pointerEvents: 'none',
                }}
              >{s.content}</span>
            )}
            {sel && (
              <>
                <button className="s-handle del" onPointerDown={(e) => { e.stopPropagation(); remove(s.id); setSelected(null); }} aria-label="delete sticker">×</button>
                <button className="s-handle sr" onPointerDown={(e) => onHandleDown(e, s.id)} aria-label="scale and rotate">⤡</button>
              </>
            )}
          </div>
        );
      })}
      <style jsx>{`
        .sticker-layer { position: absolute; top: 0; left: 0; touch-action: none; }
        .sticker { position: absolute; display: grid; place-items: center; cursor: grab; }
        .sticker.sel { outline: 2px dashed var(--pink); outline-offset: 4px; border-radius: 6px; }
        .s-handle { position: absolute; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; color: #fff; font-weight: 800; display: grid; place-items: center; box-shadow: var(--shadow-sm); font-size: 0.9rem; }
        .del { top: -12px; right: -12px; background: var(--pink-deep); }
        .sr { bottom: -12px; right: -12px; background: var(--sky); color: var(--brown); cursor: nwse-resize; }
      `}</style>
    </div>
  );
}
