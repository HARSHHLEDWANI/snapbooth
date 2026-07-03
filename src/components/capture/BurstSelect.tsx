'use client';
import { useEffect, useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { renderFilteredToDataURL } from '@/lib/capture/frameGrab';
import { play } from '@/lib/sound/sound';

/** After a burst, pick your favourite 4 shots for the strip.
 *  onDone receives the picked pool indices (used to sync the pick in duo rooms). */
export function BurstSelect({ onDone, onCancel }: { onDone: (indices: number[]) => void; onCancel: () => void }) {
  const pool = useBoothStore((s) => s.burstPool);
  const filterId = useBoothStore((s) => s.filterId);
  const setShots = useBoothStore((s) => s.setShots);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all(pool.map((p) => renderFilteredToDataURL(p.sourceDataURL, { filterId }).catch(() => p.sourceDataURL)))
      .then((t) => alive && setThumbs(t));
    return () => { alive = false; };
  }, [pool, filterId]);

  const toggle = (id: string) => {
    play('pop');
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  };

  const confirm = () => {
    const chosen = picked.map((id) => pool.find((p) => p.id === id)!).filter(Boolean);
    const indices = picked.map((id) => pool.findIndex((p) => p.id === id)).filter((i) => i >= 0);
    setShots(chosen);
    play('success');
    onDone(indices);
  };

  return (
    <div className="overlay">
      <div className="panel card grain">
        <span className="label-spaced">p i c k&nbsp;&nbsp;y o u r&nbsp;&nbsp;f a v e&nbsp;&nbsp;4</span>
        <h3>choose 4 of 8 ✨ <small>{picked.length}/4</small></h3>
        <div className="grid">
          {pool.map((p, i) => {
            const on = picked.includes(p.id);
            const order = picked.indexOf(p.id);
            return (
              <button key={p.id} className={`cell ${on ? 'on' : ''}`} onClick={() => toggle(p.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbs[i] || p.sourceDataURL} alt={`burst ${i + 1}`} />
                {on && <span className="badge">{order + 1}</span>}
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onCancel}>retake</button>
          <button className="btn btn-primary" disabled={picked.length !== 4} onClick={confirm}>
            make my strip →
          </button>
        </div>
      </div>
      <style jsx>{`
        .overlay { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(107,79,79,0.35); backdrop-filter: blur(3px); padding: 16px; }
        .panel { position: relative; width: min(560px, 96%); padding: 18px; display: flex; flex-direction: column; gap: 10px; text-align: center; }
        h3 { font-size: 1.3rem; } h3 small { color: var(--pink); }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 520px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        .cell { position: relative; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden; border: 3px solid #fff; box-shadow: var(--shadow-sm); padding: 0; }
        .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cell.on { border-color: var(--pink); box-shadow: 0 0 0 3px var(--blush), var(--shadow-sm); }
        .badge { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; background: var(--pink); color: #fff; display: grid; place-items: center; font-weight: 800; border: 2px solid #fff; }
        .actions { display: flex; gap: 10px; justify-content: center; margin-top: 4px; }
      `}</style>
    </div>
  );
}
