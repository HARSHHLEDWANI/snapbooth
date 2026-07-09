'use client';

/**
 * RoomGate — shown when a two-player activity is opened without a room.
 * Reuses the DuoLobby; once connected the gate simply disappears
 * (duo.connected flips and ActivityHost re-renders the real activity).
 */

import { useState } from 'react';
import { DuoLobby } from '@/components/duo/DuoLobby';
import { play } from '@/lib/sound/sound';

export function RoomGate({ allowPassPlay, onPassPlay }: {
  allowPassPlay?: boolean;
  onPassPlay?: () => void;
}) {
  const [lobbyOpen, setLobbyOpen] = useState(false);

  return (
    <div className="gate card grain">
      <div className="gate-emoji" aria-hidden>💌</div>
      <h3>this one’s better together</h3>
      <p>open a room and share the 5-letter code with your person — the game starts the moment they join.</p>
      <button className="btn btn-primary" onClick={() => { play('pop'); setLobbyOpen(true); }}>💞 open / join a room</button>
      {allowPassPlay && (
        <button className="btn btn-ghost" onClick={() => { play('pop'); onPassPlay?.(); }}>
          🤝 pass-and-play on this device
        </button>
      )}

      {lobbyOpen && (
        <DuoLobby
          onConnected={() => setLobbyOpen(false)}
          onClose={() => setLobbyOpen(false)}
        />
      )}

      <style jsx>{`
        .gate { position: relative; align-self: center; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 34px 30px; text-align: center; max-width: 400px; }
        .gate-emoji { font-size: 2.6rem; animation: float-y 3s ease-in-out infinite; }
        .gate h3 { font-size: 1.4rem; color: var(--pink-deep); }
        .gate p { font-size: 0.92rem; color: var(--brown); line-height: 1.45; }
      `}</style>
    </div>
  );
}
