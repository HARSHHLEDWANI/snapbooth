'use client';
import { MODES } from '@/lib/capture/modes';
import { useBoothStore } from '@/store/useBoothStore';
import { play } from '@/lib/sound/sound';

/** The capture-mode dial. Rotates a pointer to the selected mode.
 *  In duo rooms, boomerang & smile are solo-only and hidden. */
export function ModeDial({ disabled, duo }: { disabled?: boolean; duo?: boolean }) {
  const mode = useBoothStore((s) => s.captureMode);
  const setMode = useBoothStore((s) => s.setMode);
  const modes = duo ? MODES.filter((m) => m.id !== 'boomerang' && m.id !== 'smile') : MODES;
  let idx = modes.findIndex((m) => m.id === mode);
  if (idx === -1) idx = 0; // mode not available in duo — show first
  const active = modes[idx];

  const step = (dir: 1 | -1) => {
    if (disabled) return;
    const next = modes[(idx + dir + modes.length) % modes.length];
    setMode(next.id);
    play('pop');
  };

  return (
    <div className="mode-dial">
      <span className="label-spaced">m o d e</span>
      <div className="dial-row">
        <button className="dial-arrow" onClick={() => step(-1)} disabled={disabled} aria-label="previous mode">‹</button>
        <div className="dial-face" role="group" aria-label={`mode: ${active.label}`}>
          <div className="dial-icon" style={{ transform: `rotate(${idx * 8 - 16}deg)` }}>{active.icon}</div>
          <div className="dial-text">
            <strong>{active.label}</strong>
            <small>{active.hint}</small>
          </div>
        </div>
        <button className="dial-arrow" onClick={() => step(1)} disabled={disabled} aria-label="next mode">›</button>
      </div>
      <div className="dial-dots">
        {modes.map((m, i) => (
          <button
            key={m.id}
            className={`dot ${i === idx ? 'on' : ''}`}
            aria-label={m.label}
            onClick={() => !disabled && (setMode(m.id), play('pop'))}
          />
        ))}
      </div>
      <style jsx>{`
        .mode-dial { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .dial-row { display: flex; align-items: center; gap: 8px; }
        .dial-arrow {
          width: 34px; height: 34px; border-radius: 50%;
          border: 2.5px solid var(--brown); background: var(--butter);
          font-size: 1.3rem; font-weight: 800; color: var(--brown);
          box-shadow: var(--shadow-sm); line-height: 1;
        }
        .dial-arrow:active { transform: translateY(2px); }
        .dial-arrow:disabled { opacity: 0.4; }
        .dial-face {
          display: flex; align-items: center; gap: 10px;
          background: var(--white); border: 2.5px solid var(--brown);
          border-radius: 18px; padding: 8px 14px; min-width: 150px;
          box-shadow: var(--shadow-sm);
        }
        .dial-icon {
          font-size: 1.5rem; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
          filter: drop-shadow(1px 1px 0 rgba(107,79,79,0.2));
        }
        .dial-text { display: flex; flex-direction: column; line-height: 1.1; }
        .dial-text strong { font-family: var(--font-display); font-size: 0.92rem; }
        .dial-text small { font-size: 0.68rem; color: var(--brown-soft); }
        .dial-dots { display: flex; gap: 6px; }
        .dot {
          width: 9px; height: 9px; border-radius: 50%;
          border: 1.5px solid var(--brown); background: var(--white); padding: 0;
        }
        .dot.on { background: var(--pink); }
      `}</style>
    </div>
  );
}
