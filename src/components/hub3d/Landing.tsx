'use client';

/**
 * Landing — the hub street. A tiny pastel world with five machines; the HUD
 * floats on top with the title, a plain-text nav escape hatch, the room
 * button, and the privacy promise footer.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { APP_NAME, APP_TAGLINE, PRIVACY_PROMISE, accentById } from '@/config/app';
import { useBoothStore, type ActivityId } from '@/store/useBoothStore';
import { supportsWebGL, prefersReducedMotion } from '@/lib/device';
import { currentTheme, THEMES, type DayTheme } from '@/lib/daynight';
import { initSound, play } from '@/lib/sound/sound';
import { getActiveRoom } from '@/lib/room/room';
import { Decorations } from '@/components/ui/Decorations';
import { LiteStreet } from './LiteStreet';
import { DuoLobby } from '@/components/duo/DuoLobby';
import type { StreetDest } from './StreetScene';

// 3D scene is a separate chunk — only fetched when we actually render it.
const HubCanvas = dynamic(() => import('./HubCanvas').then((m) => m.HubCanvas), { ssr: false });

const NAV: { dest: StreetDest; label: string }[] = [
  { dest: 'booth', label: 'photobooth' },
  { dest: 'quiz', label: 'quiz' },
  { dest: 'draw', label: 'draw' },
  { dest: 'debate', label: 'debate' },
  { dest: 'arcade', label: 'arcade' },
];

export function Landing() {
  const liteMode = useBoothStore((s) => s.liteMode);
  const setLite = useBoothStore((s) => s.setLite);
  const duo = useBoothStore((s) => s.duo);
  const accent = useBoothStore((s) => s.accent);
  const [webgl, setWebgl] = useState(true);
  const [theme, setTheme] = useState<DayTheme>('day');
  const [duoOpen, setDuoOpen] = useState(false);
  const [roomParam, setRoomParam] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setWebgl(supportsWebGL());
    setTheme(currentTheme());
    // keep the street's light in step with the visitor's clock
    const timer = setInterval(() => setTheme(currentTheme()), 60_000);
    // arrived via a shared room link? straight into the lobby
    const p = new URLSearchParams(location.search).get('room');
    if (p) {
      setRoomParam(p.toLowerCase());
      setDuoOpen(true);
    }
    return () => clearInterval(timer);
  }, []);

  const use3D = webgl && !liteMode;
  const tokens = THEMES[theme];

  const openDest = useCallback((dest: StreetDest) => {
    const st = useBoothStore.getState();
    const room = getActiveRoom();
    if (dest === 'booth') {
      if (st.duo.connected) room?.send({ t: 'open-booth' });
      st.setPhase('capture');
    } else {
      if (st.duo.connected) room?.send({ t: 'open-activity', a: dest as ActivityId });
      st.openActivity(dest as ActivityId);
    }
  }, []);

  const navTo = (dest: StreetDest) => {
    initSound();
    play('pop');
    setLeaving(true);
    openDest(dest);
  };

  return (
    <div className="landing" data-theme={theme}>
      <div className="sky" style={{ background: tokens.skyCss }} />
      {theme === 'day' && <div className="sun-glow" aria-hidden />}
      {theme === 'night' && <div className="moon" aria-hidden />}
      <Decorations dense={theme !== 'night'} />

      <div className="scene">
        {use3D ? (
          <HubCanvas
            theme={tokens}
            reduced={prefersReducedMotion()}
            onBegin={() => setLeaving(true)}
            onOpen={openDest}
          />
        ) : (
          <div className="lite-wrap"><LiteStreet theme={theme} onOpen={navTo} /></div>
        )}
      </div>

      {/* plain-text nav for people who hate 3D */}
      <nav className={`plain-nav ${leaving ? 'leaving' : ''}`} aria-label="activities">
        {NAV.map((n) => (
          <button key={n.dest} onClick={() => navTo(n.dest)}>{n.label}</button>
        ))}
      </nav>

      <div className={`hud ${leaving ? 'leaving' : ''}`}>
        <div className="title-wrap">
          <span className="hello label-spaced">{APP_TAGLINE}</span>
          <h1 className="title">{APP_NAME}</h1>
          {duo.connected ? (
            <div className="room-chip" style={{ borderColor: accentById(accent).value }}>
              <span className="dot on" /> together in room <b>{duo.code}</b> ♡
            </div>
          ) : (
            <div className="feature-chips" aria-hidden>
              <span>photobooth</span><i>✦</i><span>games</span><i>✦</i><span>for the two of you</span>
            </div>
          )}
        </div>
        <div className="cta-row">
          <button className="btn btn-primary enter-cta" onClick={() => navTo('booth')}>📸 the photobooth</button>
          {!duo.connected && (
            <button className="btn duo-cta" onClick={() => { initSound(); play('pop'); setDuoOpen(true); }}>
              💞 open a room
            </button>
          )}
        </div>
        <button className="lite-toggle" onClick={() => setLite(!liteMode)}>
          {liteMode ? '✦ try the 3d street' : '✦ lite mode'}
        </button>
        <span className="promise">{PRIVACY_PROMISE}</span>
      </div>

      {duoOpen && (
        <DuoLobby
          joinCode={roomParam}
          onConnected={() => { setDuoOpen(false); setRoomParam(null); history.replaceState(null, '', location.pathname); }}
          onClose={() => {
            setDuoOpen(false);
            setRoomParam(null);
            // clean the ?room param so refresh doesn't rejoin
            history.replaceState(null, '', location.pathname);
          }}
        />
      )}

      <style jsx>{`
        .landing { position: absolute; inset: 0; overflow: hidden; }
        .sky { position: absolute; inset: 0; transition: background 1.2s ease; }
        .sun-glow { position: absolute; top: -18vh; left: 50%; transform: translateX(-50%); width: 90vmin; height: 90vmin; border-radius: 50%; background: radial-gradient(circle, rgba(255,244,214,0.9), transparent 65%); }
        .moon { position: absolute; top: 8vh; right: 12vw; width: 64px; height: 64px; border-radius: 50%; background: #fff6d8; box-shadow: 0 0 34px rgba(255,246,216,0.8), inset -12px -8px 0 rgba(214,196,150,0.55); }
        .scene { position: absolute; inset: 0; z-index: 1; }
        .lite-wrap { position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 20vh; }

        .plain-nav { position: absolute; z-index: 6; top: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: rgba(255,255,255,0.72); border: 2px dashed var(--blush); border-radius: 999px; padding: 4px 8px; transition: opacity 0.4s ease; }
        .plain-nav.leaving { opacity: 0; pointer-events: none; }
        .plain-nav button { background: none; border: none; font-weight: 800; font-size: 0.78rem; letter-spacing: 0.08em; color: var(--brown); padding: 4px 9px; border-radius: 999px; }
        .plain-nav button:hover { background: var(--blush); }

        .hud { position: absolute; z-index: 5; left: 0; right: 0; bottom: 3.2vh; display: flex; flex-direction: column; align-items: center; gap: 12px; transition: opacity 0.5s ease, transform 0.5s ease; pointer-events: none; }
        .hud > * { pointer-events: auto; }
        .hud.leaving { opacity: 0; transform: translateY(20px); pointer-events: none; }
        .title-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
        .hello { font-size: 0.66rem; max-width: 92vw; }
        [data-theme='night'] .hello { color: #e8dff5; }
        .title { font-size: clamp(2.8rem, 9vw, 5rem); color: var(--pink); text-shadow: 3px 4px 0 #fff, 7px 9px 0 rgba(107,79,79,0.14); letter-spacing: -0.02em; line-height: 0.95; }
        .feature-chips { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.74rem; color: var(--brown); background: rgba(255,255,255,0.65); border-radius: 999px; padding: 4px 14px; border: 2px dashed var(--blush); }
        .feature-chips i { color: var(--pink); font-style: normal; font-size: 0.6rem; }
        .room-chip { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.8rem; color: var(--brown); background: rgba(255,255,255,0.85); border-radius: 999px; padding: 5px 14px; border: 2.5px solid var(--pink); }
        .room-chip .dot { width: 9px; height: 9px; border-radius: 50%; background: #6fcf7c; box-shadow: 0 0 6px #6fcf7c; }
        .cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
        .enter-cta { font-size: 1.15rem; padding: 0.75em 1.5em; animation: float-y 3s ease-in-out infinite; }
        .duo-cta { font-size: 1.05rem; background: var(--sky); }
        .lite-toggle { background: rgba(255,255,255,0.7); border: 2px solid var(--brown); border-radius: 999px; padding: 4px 13px; font-weight: 700; font-size: 0.75rem; color: var(--brown); box-shadow: var(--shadow-sm); }
        .promise { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; color: var(--brown-soft); background: rgba(255,255,255,0.6); border-radius: 999px; padding: 3px 12px; }
        [data-theme='night'] .promise { background: rgba(38,42,85,0.55); color: #e8dff5; }
        @media (max-width: 640px) { .plain-nav { top: 8px; } .hud { bottom: 2vh; } }
      `}</style>
    </div>
  );
}
