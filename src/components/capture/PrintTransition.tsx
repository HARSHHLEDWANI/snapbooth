'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useBoothStore } from '@/store/useBoothStore';
import { compositeStrip } from '@/lib/export/composite';
import { play } from '@/lib/sound/sound';
import { prefersReducedMotion } from '@/lib/device';

/** The strip "prints" — slides out of the slot, dangles with a little swing,
 *  then hands off to the edit screen. */
export function PrintTransition({ onDone }: { onDone: () => void }) {
  const shots = useBoothStore((s) => s.shots);
  const edit = useBoothStore((s) => s.edit);
  const [src, setSrc] = useState<string | null>(null);
  const stripRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    compositeStrip(shots, edit, { width: 300, scale: 1 })
      .then((c) => alive && setSrc(c.toDataURL('image/png')))
      .catch(() => alive && onDone());
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!src || !stripRef.current) return;
    const el = stripRef.current;
    if (prefersReducedMotion()) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    play('printer');
    const tl = gsap.timeline({ onComplete: () => setTimeout(onDone, 350) });
    tl.fromTo(el, { yPercent: -100, opacity: 1 }, { yPercent: 0, duration: 1.4, ease: 'power1.inOut' })
      .to(el, { rotation: 3, duration: 0.4, ease: 'sine.inOut' })
      .to(el, { rotation: -2.5, duration: 0.5, ease: 'sine.inOut' })
      .to(el, { rotation: 0, duration: 0.5, ease: 'sine.out' });
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className="print-overlay">
      <div className="machine-slot" aria-hidden />
      <div className="strip-clip">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={stripRef} src={src} alt="your photo strip printing" className="print-strip" />
        )}
      </div>
      <p className="print-caption">printing your strip… ♡</p>
      <style jsx>{`
        .print-overlay {
          position: absolute; inset: 0; z-index: 45; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start; padding-top: 12vh;
          background: radial-gradient(circle at 50% 30%, rgba(255,214,224,0.5), rgba(107,79,79,0.4));
          backdrop-filter: blur(2px);
        }
        .machine-slot { width: 200px; height: 16px; background: #2b2320; border-radius: 8px; box-shadow: inset 0 4px 6px rgba(0,0,0,0.6); z-index: 2; }
        .strip-clip { width: 200px; overflow: hidden; margin-top: -2px; }
        .print-strip { width: 190px; display: block; margin: 0 auto; transform-origin: top center; filter: drop-shadow(3px 8px 8px rgba(107,79,79,0.4)); border-radius: 6px; }
        .print-caption { margin-top: 16px; font-family: var(--font-hand); font-size: 1.3rem; color: #fff; text-shadow: 1px 2px 0 var(--pink); }
      `}</style>
    </div>
  );
}
