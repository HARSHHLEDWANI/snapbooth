'use client';

/**
 * ActivityHost — shell for every date activity. Renders the header (back to
 * the street, room status, "booth pic" shortcut), gates two-player games
 * behind a room, and lazy-loads the selected activity as its own chunk.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { accentById } from '@/config/app';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import { Decorations } from '@/components/ui/Decorations';
import { RoomGate } from './RoomGate';

const Quiz = dynamic(() => import('./quiz/QuizActivity').then((m) => m.QuizActivity), { ssr: false });
const Draw = dynamic(() => import('./draw/DrawActivity').then((m) => m.DrawActivity), { ssr: false });
const Debate = dynamic(() => import('./debate/DebateActivity').then((m) => m.DebateActivity), { ssr: false });
const Arcade = dynamic(() => import('./arcade/ArcadeActivity').then((m) => m.ArcadeActivity), { ssr: false });
const Decide = dynamic(() => import('./decide/DecideActivity').then((m) => m.DecideActivity), { ssr: false });
const Pick = dynamic(() => import('./pick/PickActivity').then((m) => m.PickActivity), { ssr: false });
const Hangout = dynamic(() => import('./hangout/HangoutActivity').then((m) => m.HangoutActivity), { ssr: false });
const Rope = dynamic(() => import('./rope/RopeActivity').then((m) => m.RopeActivity), { ssr: false });

const TITLES: Record<string, { emoji: string; title: string }> = {
  quiz: { emoji: '💭', title: 'how well do you know me' },
  draw: { emoji: '🎨', title: 'draw together' },
  debate: { emoji: '👑', title: 'debate club' },
  arcade: { emoji: '🕹️', title: 'mini arcade' },
  decide: { emoji: '🤝', title: 'we decide' },
  pick: { emoji: '🖼️', title: 'who’d pick this?' },
  hangout: { emoji: '☕', title: 'the hangout' },
  rope: { emoji: '🎀', title: 'tied together' },
};

/** Props every activity component receives. */
export interface ActivityProps {
  /** true only for quiz pass-and-play on one device */
  solo: boolean;
  role: 'host' | 'guest';
  /** jump both people into the duo booth to remember this */
  onBoothPic: () => void;
}

export function ActivityHost() {
  const activity = useBoothStore((s) => s.activity);
  const duo = useBoothStore((s) => s.duo);
  const accent = useBoothStore((s) => s.accent);
  const closeActivity = useBoothStore((s) => s.closeActivity);
  const [passPlay, setPassPlay] = useState(false);

  if (!activity) return null;
  const meta = TITLES[activity];
  const gated = !duo.connected && !(activity === 'quiz' && passPlay);

  const onBoothPic = () => {
    play('pop');
    getActiveRoom()?.send({ t: 'open-booth' });
    useBoothStore.getState().setPhase('capture');
  };

  const back = () => {
    play('pop');
    closeActivity();
  };

  return (
    <div className="act-screen">
      <Decorations />
      <header className="act-head">
        <button className="btn btn-ghost mini" onClick={back}>← street</button>
        <div className="act-title">
          <span className="act-emoji">{meta.emoji}</span>
          <h2>{meta.title}</h2>
        </div>
        <div className="act-right">
          {duo.connected && (
            <>
              <span className="room-pill" style={{ borderColor: accentById(accent).value }}>
                <span className="dot on" /> {duo.code}
              </span>
              <button className="btn btn-ghost mini" onClick={onBoothPic} title="take a booth pic together">📸</button>
            </>
          )}
        </div>
      </header>

      <main className="act-body">
        {gated ? (
          <RoomGate
            allowPassPlay={activity === 'quiz'}
            onPassPlay={() => setPassPlay(true)}
          />
        ) : (
          <>
            {activity === 'quiz' && <Quiz solo={passPlay && !duo.connected} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'draw' && <Draw solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'debate' && <Debate solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'arcade' && <Arcade solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'decide' && <Decide solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'pick' && <Pick solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'hangout' && <Hangout solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
            {activity === 'rope' && <Rope solo={false} role={duo.role ?? 'host'} onBoothPic={onBoothPic} />}
          </>
        )}
      </main>

      <style jsx>{`
        .act-screen { position: absolute; inset: 0; overflow: hidden; display: flex; flex-direction: column; background: linear-gradient(180deg, #ffeef4, var(--cream) 55%, #f3e7ff); }
        .act-head { position: relative; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; }
        .act-title { display: flex; align-items: center; gap: 8px; }
        .act-emoji { font-size: 1.5rem; }
        .act-title h2 { font-size: clamp(1.1rem, 4vw, 1.6rem); color: var(--pink-deep); }
        .act-right { display: flex; align-items: center; gap: 8px; min-width: 70px; justify-content: flex-end; }
        .room-pill { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.85); border: 2.5px solid var(--pink); border-radius: 999px; padding: 4px 12px; font-weight: 800; font-size: 0.8rem; color: var(--brown); }
        .room-pill .dot { width: 8px; height: 8px; border-radius: 50%; }
        .room-pill .dot.on { background: #6fcf7c; box-shadow: 0 0 5px #6fcf7c; }
        .act-body { position: relative; z-index: 4; flex: 1; min-height: 0; display: flex; align-items: stretch; justify-content: center; padding: 0 12px 12px; }
        .mini { font-size: 0.8rem; padding: 0.4em 1em; }
      `}</style>
    </div>
  );
}
