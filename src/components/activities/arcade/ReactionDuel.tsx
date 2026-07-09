'use client';

/**
 * ReactionDuel — the signal fires at the SAME instant on both screens
 * (host-clock fire_at, see lib/room/clock.ts); each side reports its own
 * reaction time and the faster tap takes the round. Tap early = false start.
 */

import { useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import type { GameProps } from './games';

type Msg =
  | { k: 'rd-arm'; fireAt: number }
  | { k: 'rd-tap'; ms: number }
  | { k: 'rd-rematch' };

type Phase = 'idle' | 'armed' | 'go' | 'result' | 'over';

const WIN_AT = 3;
const FALSE_START = 99999;

export default function ReactionDuel({ onExit }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [myMs, setMyMs] = useState<number | null>(null);
  const [theirMs, setTheirMs] = useState<number | null>(null);
  const [score, setScore] = useState({ me: 0, them: 0 });
  const fireLocal = useRef(0);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const send = useActivityChannel<Msg>('arcade', (m) => {
    if (m.k === 'rd-arm') arm(m.fireAt);
    else if (m.k === 'rd-tap') setTheirMs(m.ms);
    else if (m.k === 'rd-rematch') { setScore({ me: 0, them: 0 }); setPhase('idle'); }
  });

  const arm = (fireAtHost: number) => {
    const room = getActiveRoom();
    if (!room) return;
    setMyMs(null);
    setTheirMs(null);
    setPhase('armed');
    play('pop');
    fireLocal.current = room.clock.toLocal(fireAtHost);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      setPhase('go');
      play('countdown');
    }, Math.max(0, fireLocal.current - Date.now()));
  };

  const startRound = () => {
    const room = getActiveRoom();
    if (!room) return;
    // random 1.5–4s delay so it can't be memorised, in host-clock time
    const fireAt = room.clock.hostNow() + 1500 + Math.random() * 2500;
    send({ k: 'rd-arm', fireAt });
    arm(fireAt);
  };

  const tap = () => {
    if (phaseRef.current === 'armed') {
      // false start!
      if (armTimer.current) clearTimeout(armTimer.current);
      setMyMs(FALSE_START);
      send({ k: 'rd-tap', ms: FALSE_START });
      setPhase('result');
      play('printer');
    } else if (phaseRef.current === 'go' && myMs === null) {
      const ms = Math.max(1, Math.round(Date.now() - fireLocal.current));
      setMyMs(ms);
      send({ k: 'rd-tap', ms });
      setPhase('result');
      play('shutter');
    }
  };

  // both taps in → score the round
  useEffect(() => {
    if (myMs === null || theirMs === null) return;
    const iWin = myMs < theirMs;
    const tie = myMs === theirMs;
    if (!tie) {
      setScore((s) => {
        const n = { me: s.me + (iWin ? 1 : 0), them: s.them + (iWin ? 0 : 1) };
        if (n.me >= WIN_AT || n.them >= WIN_AT) setTimeout(() => setPhase('over'), 1200);
        return n;
      });
    }
    play(iWin ? 'success' : 'pop');
  }, [myMs, theirMs]);

  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  const fmt = (ms: number | null) =>
    ms === null ? '…' : ms >= FALSE_START ? 'too soon! 💥' : `${ms}ms`;

  return (
    <div className="rd">
      <div className="rd-score">
        <span>you <b>{score.me}</b></span>
        <span className="vs">⚡</span>
        <span><b>{score.them}</b> them</span>
      </div>

      <button
        className={`pad ${phase}`}
        onPointerDown={phase === 'armed' || phase === 'go' ? tap : undefined}
        onClick={phase === 'idle' ? startRound : phase === 'over' ? undefined : undefined}
        disabled={phase === 'result' && (myMs === null || theirMs === null)}
      >
        {phase === 'idle' && <span>tap to start the duel</span>}
        {phase === 'armed' && <span>wait for pink…</span>}
        {phase === 'go' && <span>TAP!!</span>}
        {phase === 'result' && (
          <span className="res">
            <em>you: {fmt(myMs)}</em>
            <em>them: {fmt(theirMs)}</em>
            {myMs !== null && theirMs !== null && (
              <strong>{myMs === theirMs ? 'tie?!' : myMs < theirMs ? 'you take it! 🎉' : 'theirs! 💅'}</strong>
            )}
          </span>
        )}
        {phase === 'over' && (
          <span className="res">
            <strong>{score.me > score.them ? 'duel champion 🏆' : 'they win the duel 🥈'}</strong>
          </span>
        )}
      </button>

      <div className="rd-row">
        {phase === 'result' && myMs !== null && theirMs !== null && score.me < WIN_AT && score.them < WIN_AT && (
          <button className="btn btn-primary" onClick={startRound}>next round ⚡</button>
        )}
        {phase === 'over' && (
          <button className="btn btn-primary" onClick={() => { send({ k: 'rd-rematch' }); setScore({ me: 0, them: 0 }); setPhase('idle'); }}>rematch</button>
        )}
        <button className="btn btn-ghost" onClick={onExit}>← games</button>
      </div>

      <style jsx>{`
        .rd { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
        .rd-score { display: flex; gap: 14px; align-items: center; font-weight: 800; color: var(--brown); background: #fff; border: 2.5px solid var(--brown); border-radius: 999px; padding: 4px 18px; box-shadow: var(--shadow-sm); }
        .rd-score b { font-family: var(--font-display); font-size: 1.2rem; color: var(--pink-deep); }
        .pad { width: min(420px, 92%); aspect-ratio: 16/10; border-radius: 26px; border: 4px solid var(--brown); box-shadow: var(--shadow-md); font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; color: var(--brown); background: var(--cream); transition: background 0.1s ease; touch-action: manipulation; }
        .pad.armed { background: var(--butter); }
        .pad.go { background: var(--pink); color: #fff; font-size: 2.2rem; }
        .pad.result, .pad.over { background: #fff; }
        .res { display: flex; flex-direction: column; gap: 4px; }
        .res em { font-style: normal; font-size: 1rem; }
        .res strong { font-size: 1.3rem; color: var(--pink-deep); }
        .rd-row { display: flex; gap: 10px; }
      `}</style>
    </div>
  );
}
