'use client';

/**
 * SyncedImage — every internet image in the app renders through this:
 * loading shimmer → the real picture → picsum fallback on error → a cute
 * broken-image card if even the fallback dies. Purely presentational; URL
 * agreement between peers is handled by whoever broadcast the URL (see
 * lib/images/images.ts sync rule).
 */

import { useEffect, useState } from 'react';
import { picsumUrl } from './images';

type Phase = 'loading' | 'ok' | 'fallback' | 'dead';

export function SyncedImage({ src, alt = '', className = '' }: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [url, setUrl] = useState(src);

  useEffect(() => { setPhase('loading'); setUrl(src); }, [src]);

  const onError = () => {
    if (phase === 'fallback' || url.includes('picsum.photos')) { setPhase('dead'); return; }
    // derive a stable-ish seed from the failed URL so both peers fall back alike
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
    setUrl(picsumUrl(h));
    setPhase('fallback');
  };

  return (
    <span className={`simg ${className}`}>
      {phase !== 'dead' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onLoad={() => setPhase((p) => (p === 'fallback' ? 'fallback' : 'ok'))}
          onError={onError}
          draggable={false}
        />
      ) : (
        <span className="dead-card">
          <span>🖼️💔</span>
          <small>this one got away</small>
        </span>
      )}
      {phase === 'loading' && <span className="shimmer" aria-hidden />}
      <style jsx>{`
        .simg { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; background: var(--blush); }
        .simg img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .shimmer { position: absolute; inset: 0; background: linear-gradient(100deg, var(--blush) 30%, #ffe9f0 48%, var(--blush) 62%); background-size: 220% 100%; animation: simg-sheen 1.1s linear infinite; }
        @keyframes simg-sheen { to { background-position: -120% 0; } }
        .dead-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: var(--cream); border: 2px dashed var(--pink); border-radius: inherit; }
        .dead-card span { font-size: 1.6rem; }
        .dead-card small { font-size: 0.68rem; font-weight: 700; color: var(--brown-soft); }
      `}</style>
    </span>
  );
}
