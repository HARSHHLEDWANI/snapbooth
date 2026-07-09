'use client';

/**
 * MemoryMatch — a 30-second emoji memory race. Both players get the SAME
 * shuffled board (shared seed), flip pairs on their own screen, and the
 * one with more pairs when the clock dies wins (ties go to the faster finish).
 */

import { useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import type { GameProps } from './games';

const EMOJI = ['🍓', '🌙', '🐰', '⭐', '🍰', '🌷', '🦋', '💌'];
const GAME_SECONDS = 30;

type Msg =
  | { k: 'mm-start'; seed: number; fireAt: number }
  | { k: 'mm-pair'; pairs: number }
  | { k: 'mm-done'; pairs: number; ms: number }
  | { k: 'mm-rematch' };

/** deterministic PRNG so both boards shuffle identically from one seed */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBoard(seed: number): string[] {
  const rng = mulberry32(seed);
  const cards = [...EMOJI, ...EMOJI];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

type Phase = 'idle' | 'countdown' | 'play' | 'done';

export default function MemoryMatch({ onExit }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [board, setBoard] = useState<string[]>([]);
  const [faceUp, setFaceUp] = useState<number[]>([]); // currently flipped (≤2)
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [theirPairs, setTheirPairs] = useState(0);
  const [result, setResult] = useState<{ me: number; them: number; msMe: number; msThem: number } | null>(null);
  const startLocal = useRef(0);
  const doneSent = useRef(false);
  const myDone = useRef<{ pairs: number; ms: number } | null>(null);
  const theirDone = useRef<{ pairs: number; ms: number } | null>(null);
  const lockRef = useRef(false);

  const send = useActivityChannel<Msg>('arcade', (m) => {
    if (m.k === 'mm-start') begin(m.seed, m.fireAt);
    else if (m.k === 'mm-pair') setTheirPairs(m.pairs);
    else if (m.k === 'mm-done') { theirDone.current = { pairs: m.pairs, ms: m.ms }; maybeFinish(); }
    else if (m.k === 'mm-rematch') reset();
  });

  const reset = () => {
    setPhase('idle');
    setBoard([]);
    setFaceUp([]);
    setSolved(new Set());
    setTheirPairs(0);
    setResult(null);
    doneSent.current = false;
    myDone.current = null;
    theirDone.current = null;
  };

  const begin = (seed: number, fireAtHost: number) => {
    const room = getActiveRoom();
    if (!room) return;
    reset();
    setBoard(buildBoard(seed));
    setPhase('countdown');
    play('pop');
    startLocal.current = room.clock.toLocal(fireAtHost);
    const tick = () => {
      const left = startLocal.current - Date.now();
      if (left <= 0) {
        setPhase('play');
        setTimeLeft(GAME_SECONDS);
        play('countdown');
        return;
      }
      setTimeout(tick, Math.min(left, 100));
    };
    tick();
  };

  const start = () => {
    const room = getActiveRoom();
    if (!room) return;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const fireAt = room.clock.hostNow() + 3000;
    send({ k: 'mm-start', seed, fireAt });
    begin(seed, fireAt);
  };

  // game clock
  useEffect(() => {
    if (phase !== 'play') return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(iv); finishMe(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finishMe = () => {
    if (doneSent.current) return;
    doneSent.current = true;
    const pairs = solvedRef.current.size / 2;
    const ms = Date.now() - startLocal.current;
    myDone.current = { pairs, ms };
    send({ k: 'mm-done', pairs, ms });
    maybeFinish();
  };

  const solvedRef = useRef(solved);
  solvedRef.current = solved;

  const maybeFinish = () => {
    if (!myDone.current || !theirDone.current) return;
    setResult({
      me: myDone.current.pairs,
      them: theirDone.current.pairs,
      msMe: myDone.current.ms,
      msThem: theirDone.current.ms,
    });
    setPhase('done');
    play('success');
  };

  const flip = (i: number) => {
    if (phase !== 'play' || lockRef.current || solved.has(i) || faceUp.includes(i)) return;
    play('pop');
    const next = [...faceUp, i];
    setFaceUp(next);
    if (next.length === 2) {
      lockRef.current = true;
      const [a, b] = next;
      if (board[a] === board[b]) {
        setTimeout(() => {
          const s = new Set(solved).add(a).add(b);
          setSolved(s);
          setFaceUp([]);
          lockRef.current = false;
          play('success');
          send({ k: 'mm-pair', pairs: s.size / 2 });
          if (s.size === board.length) finishMe(); // cleared the whole board!
        }, 260);
      } else {
        setTimeout(() => { setFaceUp([]); lockRef.current = false; }, 650);
      }
    }
  };

  const myPairs = solved.size / 2;

  return (
    <div className="mm">
      <div className="mm-score">
        <span>you <b>{myPairs}</b></span>
        {phase === 'play' && <span className={`clock ${timeLeft <= 8 ? 'low' : ''}`}>{timeLeft}s</span>}
        <span><b>{theirPairs}</b> them</span>
      </div>

      {phase === 'idle' && (
        <button className="btn btn-primary big" onClick={start}>🧠 start the race · {GAME_SECONDS}s</button>
      )}
      {phase === 'countdown' && <div className="mm-count">get ready… boards are identical 👀</div>}

      {(phase === 'play' || phase === 'done') && board.length > 0 && (
        <div className="grid">
          {board.map((e, i) => {
            const open = faceUp.includes(i) || solved.has(i);
            return (
              <button key={i} className={`cardlet ${open ? 'open' : ''} ${solved.has(i) ? 'won' : ''}`} onClick={() => flip(i)} disabled={phase !== 'play'}>
                <span className="face front">?</span>
                <span className="face back">{e}</span>
              </button>
            );
          })}
        </div>
      )}

      {phase === 'done' && result && (
        <div className="mm-result card grain">
          <strong>
            {result.me > result.them ? 'you win the race! 🏆'
              : result.me < result.them ? 'they take it 💅'
              : result.msMe <= result.msThem ? 'tie on pairs — you were faster! 🏆' : 'tie on pairs — they were faster 💨'}
          </strong>
          <em>{result.me} vs {result.them} pairs</em>
          <div className="row">
            <button className="btn btn-primary" onClick={() => { send({ k: 'mm-rematch' }); reset(); }}>rematch</button>
            <button className="btn btn-ghost" onClick={onExit}>← games</button>
          </div>
        </div>
      )}

      {phase !== 'done' && phase !== 'idle' && (
        <button className="btn btn-ghost mini" onClick={onExit}>← games</button>
      )}

      <style jsx>{`
        .mm { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
        .mm-score { display: flex; gap: 16px; align-items: center; font-weight: 800; color: var(--brown); background: #fff; border: 2.5px solid var(--brown); border-radius: 999px; padding: 4px 18px; box-shadow: var(--shadow-sm); }
        .mm-score b { font-family: var(--font-display); font-size: 1.2rem; color: var(--pink-deep); }
        .clock { font-family: var(--font-display); font-size: 1.1rem; }
        .clock.low { color: var(--pink-deep); animation: twinkle 0.8s ease-in-out infinite; }
        .big { font-size: 1.1rem; margin-top: 8vh; }
        .mm-count { font-weight: 800; color: var(--brown); margin-top: 8vh; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(400px, 94vw); }
        .cardlet { position: relative; aspect-ratio: 1; border: none; background: none; perspective: 400px; padding: 0; }
        .face { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 14px; border: 3px solid var(--brown); font-size: 1.7rem; backface-visibility: hidden; transition: transform 0.26s ease; box-shadow: var(--shadow-sm); }
        .front { background: var(--pink); color: #fff; font-family: var(--font-display); font-weight: 800; transform: rotateY(0); }
        .back { background: #fff; transform: rotateY(180deg); }
        .open .front { transform: rotateY(180deg); }
        .open .back { transform: rotateY(0); }
        .won .back { background: #d8f5e3; border-color: #3f9d68; }
        .mm-result { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 24px; text-align: center; }
        .mm-result strong { font-family: var(--font-display); font-size: 1.25rem; color: var(--pink-deep); }
        .mm-result em { font-style: normal; font-weight: 700; color: var(--brown-soft); font-size: 0.85rem; }
        .row { display: flex; gap: 10px; }
        .mini { font-size: 0.78rem; padding: 0.35em 0.9em; }
      `}</style>
    </div>
  );
}
