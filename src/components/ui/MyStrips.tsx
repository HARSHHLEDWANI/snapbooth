'use client';
import { useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { downloadBlob, stampName } from '@/lib/export/deliver';

/** Drawer of the last 6 saved strips (thumbnails in localStorage). */
export function MyStrips() {
  const strips = useBoothStore((s) => s.recentStrips);
  const [open, setOpen] = useState(false);
  if (!strips.length) return null;

  const save = async (thumb: string) => {
    const b = await (await fetch(thumb)).blob();
    downloadBlob(b, stampName('png'));
  };

  return (
    <>
      <button className="ms-tab" onClick={() => setOpen(true)}>
        ♡ my strips <span className="ms-count">{strips.length}</span>
      </button>
      {open && (
        <div className="ms-overlay" onClick={() => setOpen(false)}>
          <div className="ms-drawer card grain" onClick={(e) => e.stopPropagation()}>
            <div className="ms-head">
              <h3>my recent strips ♡</h3>
              <button className="btn btn-ghost mini" onClick={() => setOpen(false)}>close</button>
            </div>
            <div className="ms-grid scroll-y">
              {strips.map((s) => (
                <button key={s.id} className="ms-item" onClick={() => save(s.thumb)} title="download">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumb} alt="saved strip" />
                  <span>⬇</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .ms-tab { position: absolute; top: 12px; right: 12px; z-index: 25; background: rgba(255,255,255,0.85); border: 2.5px solid var(--brown); border-radius: 999px; padding: 6px 14px; font-weight: 700; color: var(--brown); box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 6px; }
        .ms-count { background: var(--pink); color: #fff; border-radius: 999px; padding: 0 7px; font-size: 0.75rem; }
        .ms-overlay { position: absolute; inset: 0; z-index: 70; background: rgba(107,79,79,0.35); backdrop-filter: blur(3px); display: flex; justify-content: flex-end; }
        .ms-drawer { position: relative; width: min(340px, 88%); height: 100%; border-radius: 24px 0 0 24px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .ms-head { display: flex; align-items: center; justify-content: space-between; }
        .ms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; overflow-y: auto; }
        .ms-item { position: relative; border-radius: 12px; overflow: hidden; border: 3px solid #fff; box-shadow: var(--shadow-sm); padding: 0; background: var(--cream); }
        .ms-item img { width: 100%; display: block; }
        .ms-item span { position: absolute; bottom: 4px; right: 4px; background: var(--pink); color: #fff; border-radius: 8px; padding: 1px 6px; font-size: 0.8rem; }
        .mini { font-size: 0.8rem; padding: 0.35em 0.8em; }
      `}</style>
    </>
  );
}
