'use client';

/**
 * ArcadeActivity — the cabinet menu. Games come from the registry in
 * games.ts; picking one pulls BOTH players into it over the shared channel.
 */

import { lazy, Suspense, useMemo, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { play } from '@/lib/sound/sound';
import type { ActivityProps } from '../ActivityHost';
import { GAMES } from './games';

type Msg = { k: 'open-game'; id: string } | { k: 'exit-game' };

export function ArcadeActivity({ role, onBoothPic }: ActivityProps) {
  const [gameId, setGameId] = useState<string | null>(null);

  const send = useActivityChannel<Msg>('arcade', (m) => {
    if (m.k === 'open-game') { setGameId(m.id); play('pop'); }
    else if (m.k === 'exit-game') setGameId(null);
  });

  const game = GAMES.find((g) => g.id === gameId) ?? null;
  const GameComp = useMemo(() => (game ? lazy(game.load) : null), [game]);

  const open = (id: string) => {
    play('pop');
    send({ k: 'open-game', id });
    setGameId(id);
  };

  const exit = () => {
    play('pop');
    send({ k: 'exit-game' });
    setGameId(null);
  };

  if (game && GameComp) {
    return (
      <div className="arc-wrap">
        <Suspense fallback={<div className="arc-loading">plugging in {game.name}…</div>}>
          <GameComp role={role} onExit={exit} />
        </Suspense>
        <style jsx>{`
          .arc-wrap { width: min(560px, 100%); display: flex; flex-direction: column; align-items: center; }
          .arc-loading { margin-top: 10vh; font-weight: 800; color: var(--brown-soft); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="arc-wrap">
      <span className="label-spaced">i n s e r t&nbsp;&nbsp;h e a r t&nbsp;&nbsp;t o&nbsp;&nbsp;p l a y</span>
      <div className="games">
        {GAMES.map((g) => (
          <button key={g.id} className="game card grain" onClick={() => open(g.id)}>
            <span className="g-emoji">{g.emoji}</span>
            <strong>{g.name}</strong>
            <small>{g.blurb}</small>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost mini" onClick={onBoothPic}>📸 or take a booth pic instead</button>
      <style jsx>{`
        .arc-wrap { width: min(560px, 100%); display: flex; flex-direction: column; align-items: center; gap: 16px; padding-top: 4vh; }
        .games { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .game { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 200px; padding: 24px 16px 18px; }
        .game:hover { transform: translateY(-4px); }
        .g-emoji { font-size: 2.4rem; }
        .game strong { font-family: var(--font-display); font-size: 1.1rem; color: var(--pink-deep); }
        .game small { font-size: 0.75rem; color: var(--brown-soft); font-weight: 700; line-height: 1.35; }
        .mini { font-size: 0.8rem; padding: 0.4em 1em; }
      `}</style>
    </div>
  );
}
