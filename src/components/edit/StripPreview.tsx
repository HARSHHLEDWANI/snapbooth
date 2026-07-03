'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { compositeStrip } from '@/lib/export/composite';
import { StickerLayer } from './StickerLayer';

export interface StripPreviewHandle {
  /** Composite at export scale; returns the finished canvas. */
  exportCanvas: (scale: number) => Promise<HTMLCanvasElement>;
  baseWidth: number;
}

/**
 * Live preview of the strip. The photo/frame/caption layer is rendered to a
 * canvas via the SAME compositor used for export (guaranteeing parity), while
 * stickers live as DOM overlays for buttery 60fps drag/scale/rotate — they get
 * baked into the canvas only at export time.
 *
 * The strip is auto-scaled to fit the available column (fit-to-height).
 */
export const StripPreview = forwardRef<StripPreviewHandle>(function StripPreview(_props, ref) {
  const shots = useBoothStore((s) => s.shots);
  const edit = useBoothStore((s) => s.edit);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aspect, setAspect] = useState(3); // strip h/w
  const [avail, setAvail] = useState({ w: 320, h: 640 });
  const BASE = 300; // internal composite resolution (px)

  // measure available space
  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setAvail({ w: el.clientWidth - 16, h: el.clientHeight - 16 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // rAF-gated recompositing: coalesces rapid edits, never piles up work.
  const needs = useRef(true);
  const busy = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => { needs.current = true; }, [
    shots, edit.layout, edit.filterId, edit.frameColor, edit.corners,
    edit.caption, edit.showDate, edit.showFooter,
    edit.adjust.brightness, edit.adjust.contrast, edit.adjust.saturation, edit.adjust.warmth, edit.adjust.grain,
  ]);

  const paint = useCallback(async () => {
    if (busy.current || !needs.current) return;
    busy.current = true;
    needs.current = false;
    try {
      const state = useBoothStore.getState();
      const canvas = await compositeStrip(state.shots, state.edit, { width: BASE, scale: 1 });
      const host = canvasHostRef.current;
      if (host) {
        if (canvasRef.current) host.removeChild(canvasRef.current);
        canvas.className = 'strip-canvas';
        host.appendChild(canvas);
        canvasRef.current = canvas;
        setAspect(canvas.height / canvas.width);
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const loop = () => {
      paint();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paint]);

  useImperativeHandle(ref, () => ({
    baseWidth: BASE,
    exportCanvas: async (scale: number) => {
      const state = useBoothStore.getState();
      return compositeStrip(state.shots, state.edit, { width: BASE, scale });
    },
  }), []);

  // fit-to-height display size (canvas internally stays at BASE px)
  const displayW = Math.max(150, Math.min(avail.w, avail.h / aspect, 380));
  const displayH = displayW * aspect;

  return (
    <div ref={wrapRef} className="strip-preview" style={{ width: displayW }}>
      <div className="strip-host" ref={canvasHostRef} style={{ width: displayW, height: displayH }} />
      <StickerLayer width={displayW} height={displayH} />
      <style jsx>{`
        .strip-preview { position: relative; filter: drop-shadow(4px 8px 10px rgba(107,79,79,0.28)); }
        .strip-host { position: relative; }
        :global(.strip-canvas) { width: 100%; height: 100%; display: block; border-radius: 8px; }
      `}</style>
    </div>
  );
});
