'use client';

/**
 * usePreviewPipeline — owns the live preview canvas.
 *
 * solo: local webcam → FilterRenderer → preview canvas.
 * duo:  local + partner rendered through the SAME filter, composited
 *       side by side (host left / guest right on both ends) at 60fps.
 *
 * The returned canvas is plain 2D-composited output; it can be inserted into
 * the DOM (lite interior) or sampled as a THREE.CanvasTexture (3D interior).
 */

import { useEffect, useRef, type RefObject } from 'react';
import { FilterRenderer } from '@/lib/shaders/FilterRenderer';
import { filterIndex } from '@/lib/shaders/filters';
import { useBoothStore } from '@/store/useBoothStore';

export function usePreviewPipeline(
  videoRef: RefObject<HTMLVideoElement | null>,
  remoteVideoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ONE shared GL renderer for both feeds (rendered sequentially per frame) —
  // keeps the total WebGL context count low so the 3D scene never starves.
  const rendererRef = useRef<FilterRenderer | null>(null);
  const raf = useRef(0);
  const frameTick = useRef(0); // bumped each paint — 3D texture watches this

  if (!canvasRef.current && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    // friendly placeholder until the first video frame lands
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2b2320';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffd6e0';
    ctx.font = "700 54px 'Baloo 2', 'Quicksand', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('warming up the camera… ✨', c.width / 2, c.height / 2);
    canvasRef.current = c;
  }

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!rendererRef.current) rendererRef.current = new FilterRenderer();
    } catch {
      useBoothStore.getState().setLite(true);
      return;
    }

    const ctx = canvasRef.current!.getContext('2d')!;

    // stage video frames through 2D canvases before the GL upload —
    // texImage2D straight from a <video> stalls on some software rasterizers.
    const stageL = document.createElement('canvas');
    const stageR = document.createElement('canvas');
    const stage = (v: HTMLVideoElement, c: HTMLCanvasElement): HTMLCanvasElement => {
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth || 2;
        c.height = v.videoHeight || 2;
      }
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      return c;
    };

    const drawHalf = (src: HTMLCanvasElement, x: number, w: number, H: number) => {
      // cover-crop the rendered feed into its half
      const s = Math.max(w / src.width, H / src.height);
      const sw = w / s, sh = H / s;
      ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, x, 0, w, H);
    };

    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      const st = useBoothStore.getState();
      const canvas = canvasRef.current!;
      const r = rendererRef.current!;
      const lv = videoRef.current;
      const rv = remoteVideoRef.current;
      const fi = filterIndex(st.filterId);
      // __SB_NO_PREVIEW: test-only hook — software rasterizers (headless CI)
      // hard-stall when consuming WebRTC video frames; real GPUs are fine.
      const noPreview = (window as unknown as { __SB_NO_PREVIEW?: boolean }).__SB_NO_PREVIEW;
      const duo = !noPreview && st.duo.connected && rv && rv.readyState >= 2;
      const localReady = !noPreview && lv && lv.readyState >= 2;
      if (!localReady && !duo) return;

      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = '#1b1414';
      ctx.fillRect(0, 0, W, H);

      if (duo) {
        const isHost = st.duo.role === 'host';
        const half = W / 2;
        // one renderer, two sequential passes (local then remote)
        if (localReady) {
          r.render(stage(lv!, stageL), { filterIndex: fi, mirror: st.mirror });
          drawHalf(r.canvas, isHost ? 0 : half, half, H);
        }
        r.render(stage(rv!, stageR), { filterIndex: fi, mirror: false });
        drawHalf(r.canvas, isHost ? half : 0, half, H);
        // seam
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(half - 2, 0, 4, H);
      } else if (localReady) {
        r.render(stage(lv!, stageL), { filterIndex: fi, mirror: st.mirror });
        drawHalf(r.canvas, 0, W, H);
      }
      frameTick.current++;
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [enabled, videoRef, remoteVideoRef]);

  // dispose GL on unmount
  useEffect(() => () => {
    rendererRef.current?.dispose();
    rendererRef.current = null;
  }, []);

  return { canvasRef, frameTick };
}
