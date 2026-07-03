'use client';
import { APP_NAME } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { setMuted as persistMute } from '@/lib/sound/sound';
import { getActiveRoom } from '@/lib/duo/room';

/** Slim floating top bar: brand, mirror toggle, mute, exit. */
export function TopBar() {
  const phase = useBoothStore((s) => s.phase);
  const muted = useBoothStore((s) => s.muted);
  const mirror = useBoothStore((s) => s.mirror);
  const toggleMute = useBoothStore((s) => s.toggleMute);
  const toggleMirror = useBoothStore((s) => s.toggleMirror);
  const reset = useBoothStore((s) => s.reset);

  return (
    <div className="topbar">
      <button
        className="brand"
        onClick={() => {
          getActiveRoom()?.destroy();
          useBoothStore.getState().resetDuo();
          reset();
        }}
        aria-label="back to start"
      >
        <span className="brand-dot" />{APP_NAME}
      </button>
      <div className="tb-actions">
        {phase === 'capture' && (
          <button
            className="tb-btn"
            aria-pressed={mirror}
            onClick={toggleMirror}
            title="mirror preview"
          >{mirror ? '🪞 mirror' : '↔ normal'}</button>
        )}
        <button
          className="tb-btn"
          aria-pressed={!muted}
          onClick={() => { toggleMute(); persistMute(!muted); }}
          title="sound"
        >{muted ? '🔇' : '🔊'}</button>
      </div>
      <style jsx>{`
        .topbar {
          position: absolute; top: 0; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; pointer-events: none;
        }
        .topbar > * { pointer-events: auto; }
        .brand {
          font-family: var(--font-display); font-weight: 800; font-size: 1.15rem;
          color: var(--brown); background: rgba(255,255,255,0.7); border: 2.5px solid var(--brown);
          border-radius: 999px; padding: 4px 14px 4px 10px; box-shadow: var(--shadow-sm);
          display: flex; align-items: center; gap: 8px;
        }
        .brand-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--pink); border: 2px solid var(--brown); }
        .tb-actions { display: flex; gap: 8px; }
        .tb-btn {
          background: rgba(255,255,255,0.8); border: 2.5px solid var(--brown); border-radius: 999px;
          padding: 5px 12px; font-weight: 700; font-size: 0.85rem; color: var(--brown); box-shadow: var(--shadow-sm);
        }
        .tb-btn[aria-pressed='true'] { background: var(--blush); }
      `}</style>
    </div>
  );
}
