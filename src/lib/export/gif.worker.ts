/// <reference lib="webworker" />
/**
 * gif.worker.ts — encodes boomerang/GIF frames off the main thread with gifenc.
 * Receives raw RGBA frames, quantizes + writes each, reports progress, returns
 * the finished GIF bytes. Never touches the DOM; safe to run continuously.
 */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

interface FramePayload {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
interface EncodeMsg {
  type: 'encode';
  frames: FramePayload[];
  delay: number; // ms per frame
  boomerang: boolean; // append reversed frames for ping-pong loop
}

self.onmessage = (e: MessageEvent<EncodeMsg>) => {
  const { type } = e.data;
  if (type !== 'encode') return;
  const { frames, delay, boomerang } = e.data;

  // build a boomerang sequence: 0..n-1 then n-2..1
  const seq = frames.slice();
  if (boomerang && frames.length > 2) {
    for (let i = frames.length - 2; i > 0; i--) seq.push(frames[i]);
  }

  const gif = GIFEncoder();
  const total = seq.length;

  for (let i = 0; i < total; i++) {
    const { data, width, height } = seq[i];
    // 256-colour palette per frame keeps pastel gradients clean
    const palette = quantize(data, 256, { format: 'rgb565' });
    const index = applyPalette(data, palette, 'rgb565');
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      transparent: false,
    });
    (self as unknown as Worker).postMessage({
      type: 'progress',
      value: (i + 1) / total,
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  (self as unknown as Worker).postMessage({ type: 'done', bytes }, [bytes.buffer]);
};

export {};
