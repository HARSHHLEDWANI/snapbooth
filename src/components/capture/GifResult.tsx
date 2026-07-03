'use client';
import { useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { downloadBlob, shareImage, stampName } from '@/lib/export/deliver';
import { toast } from '@/components/ui/toast';

/** Boomerang encoding progress + finished-GIF result screen. */
export function GifResult({
  encoding,
  progress,
  onClose,
}: {
  encoding: boolean;
  progress: number;
  onClose: () => void;
}) {
  const url = useBoothStore((s) => s.boomerangUrl);
  const [busy, setBusy] = useState(false);

  const getBlob = async () => (url ? await (await fetch(url)).blob() : null);

  const onDownload = async () => {
    const b = await getBlob();
    if (b) { downloadBlob(b, stampName('gif')); toast('saved your boomerang!', 'ok'); }
  };
  const onShare = async () => {
    const b = await getBlob();
    if (!b) return;
    setBusy(true);
    const ok = await shareImage(b, stampName('gif'));
    setBusy(false);
    if (!ok) { downloadBlob(b, stampName('gif')); toast('sharing not supported — downloaded instead', 'info'); }
  };

  return (
    <div className="overlay">
      <div className="panel card grain">
        {encoding ? (
          <>
            <span className="label-spaced">c o o k i n g&nbsp;&nbsp;y o u r&nbsp;&nbsp;g i f</span>
            <div className="spin" aria-hidden>🔁</div>
            <div className="pbar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p>{Math.round(progress * 100)}%</p>
          </>
        ) : (
          <>
            <span className="label-spaced">y o u r&nbsp;&nbsp;b o o m e r a n g ♡</span>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="your boomerang gif" className="gif" />
            )}
            <div className="actions">
              <button className="btn btn-ghost" onClick={onClose}>↺ again</button>
              <button className="btn btn-ghost" onClick={onShare} disabled={busy}>↗ share</button>
              <button className="btn btn-primary" onClick={onDownload}>⬇ save gif</button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .overlay { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(107,79,79,0.35); backdrop-filter: blur(3px); padding: 16px; }
        .panel { position: relative; width: min(440px, 96%); padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
        .spin { font-size: 3rem; animation: spin-slow 1.4s linear infinite; }
        .pbar { width: 100%; height: 16px; background: var(--blush); border-radius: 999px; overflow: hidden; border: 2px solid var(--brown); }
        .pbar > div { height: 100%; background: var(--pink); transition: width 0.15s ease; }
        .gif { width: 100%; border-radius: 16px; border: 4px solid #fff; box-shadow: var(--shadow-md); }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
      `}</style>
    </div>
  );
}
