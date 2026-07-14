'use client';

/**
 * LiteStreet — the 2D illustrated fallback for weak devices / no WebGL.
 * Same five destinations as the 3D street, as a cute strip of storefront cards.
 */

import type { StreetDest } from './StreetScene';
import type { DayTheme } from '@/lib/daynight';

const SPOTS: { dest: StreetDest; emoji: string; name: string; blurb: string }[] = [
  { dest: 'hangout', emoji: '☕', name: 'the hangout', blurb: 'just be together' },
  { dest: 'draw', emoji: '🎨', name: 'draw together', blurb: 'one canvas, two halves' },
  { dest: 'decide', emoji: '🤝', name: 'we decide', blurb: 'settle it as one' },
  { dest: 'quiz', emoji: '💭', name: 'know-me quiz', blurb: 'guess each other' },
  { dest: 'booth', emoji: '📸', name: 'photobooth', blurb: 'for one or two' },
  { dest: 'pick', emoji: '🖼️', name: 'who’d pick this?', blurb: 'bet on their taste' },
  { dest: 'arcade', emoji: '🕹️', name: 'arcade', blurb: 'tiny synced duels' },
  { dest: 'rope', emoji: '🎀', name: 'tied together', blurb: 'two blobs, one ribbon' },
  { dest: 'debate', emoji: '👑', name: 'debate club', blurb: 'win the crown' },
];

export function LiteStreet({ theme, onOpen }: { theme: DayTheme; onOpen: (d: StreetDest) => void }) {
  return (
    <div className="lite-street">
      {SPOTS.map((s) => (
        <button key={s.dest} className={`shop ${s.dest === 'booth' ? 'hero' : ''}`} onClick={() => onOpen(s.dest)}>
          <span className="awning" aria-hidden />
          <span className="shop-emoji" aria-hidden>{s.emoji}</span>
          <span className="shop-name">{s.name}</span>
          <span className="shop-blurb">{s.blurb}</span>
          {theme === 'night' && <span className="glow" aria-hidden />}
        </button>
      ))}
      <style jsx>{`
        .lite-street { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; align-items: flex-end; max-width: 860px; padding: 12px; }
        .shop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 140px; padding: 26px 10px 14px; background: var(--white); border: 3px solid var(--brown); border-radius: 18px; box-shadow: var(--shadow-md); overflow: hidden; transition: transform 0.15s ease; }
        .shop:hover { transform: translateY(-6px); }
        .shop.hero { width: 170px; padding-top: 34px; background: var(--blush); }
        .awning { position: absolute; top: 0; left: 0; right: 0; height: 16px; background: repeating-linear-gradient(90deg, var(--pink) 0 16px, var(--cream) 16px 32px); border-bottom: 2.5px solid var(--brown); }
        .shop-emoji { font-size: 2.2rem; }
        .hero .shop-emoji { font-size: 2.8rem; }
        .shop-name { font-family: var(--font-display); font-weight: 800; font-size: 0.95rem; color: var(--brown); }
        .shop-blurb { font-size: 0.68rem; font-weight: 700; color: var(--brown-soft); }
        .glow { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 26px rgba(255,232,163,0.55); border-radius: inherit; }
        @media (max-width: 640px) { .lite-street { flex-direction: column; align-items: center; } .shop { flex-direction: row; width: min(320px, 90vw); padding: 18px 16px 14px 20px; justify-content: flex-start; gap: 12px; } .awning { height: 10px; } }
      `}</style>
    </div>
  );
}
