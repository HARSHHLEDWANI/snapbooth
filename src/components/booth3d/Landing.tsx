'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { APP_NAME } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { supportsWebGL, prefersReducedMotion } from '@/lib/device';
import { initSound, play } from '@/lib/sound/sound';
import { Decorations } from '@/components/ui/Decorations';
import { LiteExterior } from './LiteExterior';
import { MyStrips } from '@/components/ui/MyStrips';
import { DuoLobby } from '@/components/duo/DuoLobby';

// 3D scene is a separate chunk — only fetched when we actually render it.
const Booth3D = dynamic(() => import('./Booth3D').then((m) => m.Booth3D), { ssr: false });

export function Landing() {
  const phase = useBoothStore((s) => s.phase);
  const setPhase = useBoothStore((s) => s.setPhase);
  const liteMode = useBoothStore((s) => s.liteMode);
  const setLite = useBoothStore((s) => s.setLite);
  const userName = useBoothStore((s) => s.userName);
  const nameAsked = useBoothStore((s) => s.nameAsked);
  const [webgl, setWebgl] = useState(true);
  const [duoOpen, setDuoOpen] = useState(false);
  const [roomParam, setRoomParam] = useState<string | null>(null);

  useEffect(() => {
    setWebgl(supportsWebGL());
    // arrived via a shared duo link? open the lobby once the name prompt is done
    const p = new URLSearchParams(location.search).get('room');
    if (p) setRoomParam(p.toLowerCase());
  }, []);

  useEffect(() => {
    if (roomParam && nameAsked) setDuoOpen(true);
  }, [roomParam, nameAsked]);

  const use3D = webgl && !liteMode;

  const startEnter = () => {
    if (phase !== 'landing') return;
    initSound();
    play('pop');
    if (use3D && !prefersReducedMotion()) setPhase('entering');
    else setPhase('capture');
  };

  const openDuo = () => {
    initSound();
    play('pop');
    setDuoOpen(true);
  };

  return (
    <div className="landing">
      <div className="sky" />
      <div className="sun-glow" aria-hidden />
      <Decorations dense />
      <MyStrips />

      <div className="scene">
        {use3D ? (
          <Booth3D onEntered={() => setPhase('capture')} onEnterClick={startEnter} lowPower={false} />
        ) : (
          <div className="lite-wrap"><LiteExterior onEnterClick={startEnter} /></div>
        )}
      </div>

      <div className={`hud ${phase === 'entering' ? 'leaving' : ''}`}>
        <div className="title-wrap">
          <span className="hello label-spaced">
            {userName ? `hi again, ${userName} ♡` : 'y o u r  p a s t e l  d r e a m  b o o t h'}
          </span>
          <h1 className="title">{APP_NAME}</h1>
          <div className="feature-chips" aria-hidden>
            <span>12 filters</span><i>✦</i><span>boomerangs</span><i>✦</i><span>stickers</span><i>✦</i><span>booth for two</span>
          </div>
        </div>
        <div className="cta-row">
          <button className="btn btn-primary enter-cta" onClick={startEnter}>📸 enter the booth</button>
          <button className="btn duo-cta" onClick={openDuo}>💞 booth for two</button>
        </div>
        <button className="lite-toggle" onClick={() => setLite(!liteMode)}>
          {liteMode ? '✦ try 3d booth' : '✦ lite mode'}
        </button>
      </div>

      {duoOpen && (
        <DuoLobby
          joinCode={roomParam}
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
        .sky { position: absolute; inset: 0; background: linear-gradient(180deg, #bfe2ff 0%, #ffd9e6 52%, #fff0d4 100%); }
        .sun-glow { position: absolute; top: -18vh; left: 50%; transform: translateX(-50%); width: 90vmin; height: 90vmin; border-radius: 50%; background: radial-gradient(circle, rgba(255,244,214,0.9), transparent 65%); }
        .scene { position: absolute; inset: 0; z-index: 1; }
        .lite-wrap { position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 16vh; }
        .hud { position: absolute; z-index: 5; left: 0; right: 0; bottom: 4.5vh; display: flex; flex-direction: column; align-items: center; gap: 13px; transition: opacity 0.5s ease, transform 0.5s ease; pointer-events: none; }
        .hud > * { pointer-events: auto; }
        .hud.leaving { opacity: 0; transform: translateY(20px); }
        .title-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
        .hello { font-size: 0.72rem; }
        .title { font-size: clamp(2.8rem, 9vw, 5.2rem); color: var(--pink); text-shadow: 3px 4px 0 #fff, 7px 9px 0 rgba(107,79,79,0.14); letter-spacing: -0.02em; line-height: 0.95; }
        .feature-chips { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.74rem; color: var(--brown); background: rgba(255,255,255,0.65); border-radius: 999px; padding: 4px 14px; border: 2px dashed var(--blush); }
        .feature-chips i { color: var(--pink); font-style: normal; font-size: 0.6rem; }
        .cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
        .enter-cta { font-size: 1.2rem; padding: 0.75em 1.5em; animation: float-y 3s ease-in-out infinite; }
        .duo-cta { font-size: 1.05rem; background: var(--sky); }
        .lite-toggle { background: rgba(255,255,255,0.7); border: 2px solid var(--brown); border-radius: 999px; padding: 4px 13px; font-weight: 700; font-size: 0.75rem; color: var(--brown); box-shadow: var(--shadow-sm); }
        @media (max-width: 640px) { .feature-chips span:nth-child(5), .feature-chips i:nth-child(4) { display: none; } }
      `}</style>
    </div>
  );
}
