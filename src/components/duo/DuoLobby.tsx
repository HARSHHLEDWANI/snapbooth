'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { createRoom, joinRoom, makeRoomCode, roomLink, getActiveRoom } from '@/lib/duo/room';
import { play } from '@/lib/sound/sound';
import { toast } from '@/components/ui/toast';

type Stage = 'pick' | 'hosting' | 'joining' | 'error';

/**
 * DuoLobby — create a private booth room and share the link, or join one.
 * When the peers connect, both sides jump straight into the booth together.
 */
export function DuoLobby({ joinCode, onClose }: { joinCode?: string | null; onClose: () => void }) {
  const userName = useBoothStore((s) => s.userName);
  const setDuo = useBoothStore((s) => s.setDuo);
  const setPhase = useBoothStore((s) => s.setPhase);
  const [stage, setStage] = useState<Stage>(joinCode ? 'joining' : 'pick');
  const [code, setCode] = useState<string>(joinCode ?? '');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const enterBooth = useCallback((role: 'host' | 'guest', c: string) => {
    const room = getActiveRoom();
    if (!room) return;
    room.send({ t: 'hello', name: useBoothStore.getState().userName || (role === 'host' ? 'host' : 'guest') });
    room.on((msg) => {
      if (msg.t === 'hello') setDuo({ partnerName: msg.name });
      if (msg.t === 'bye') {
        setDuo({ connected: false });
        toast('your friend left the booth 💔', 'info');
      }
    });
    setDuo({ active: true, role, code: c, connected: true });
    play('success');
    setPhase('capture');
  }, [setDuo, setPhase]);

  // host flow
  const host = useCallback(async () => {
    const c = makeRoomCode();
    setCode(c);
    setStage('hosting');
    try {
      await createRoom(c); // resolves when a guest connects
      enterBooth('host', c);
    } catch (e) {
      setError((e as Error).message || 'could not open a room');
      setStage('error');
    }
  }, [enterBooth]);

  // guest flow (auto-run if arrived via link)
  const join = useCallback(async (c: string) => {
    setStage('joining');
    try {
      const room = await joinRoom(c.trim().toLowerCase());
      await room.ready;
      enterBooth('guest', c.trim().toLowerCase());
    } catch (e) {
      setError((e as Error).message || 'could not join — check the link');
      setStage('error');
    }
  }, [enterBooth]);

  useEffect(() => {
    if (joinCode && !startedRef.current) {
      startedRef.current = true;
      join(joinCode);
    }
  }, [joinCode, join]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomLink(code));
      setCopied(true);
      play('pop');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('copy failed — select the link manually', 'err');
    }
  };

  const cancel = () => {
    getActiveRoom()?.destroy();
    onClose();
  };

  return (
    <div className="duo-overlay" role="dialog" aria-label="booth for two">
      <div className="duo card grain">
        <div className="duo-hearts" aria-hidden>💞</div>
        <span className="label-spaced">b o o t h&nbsp;&nbsp;f o r&nbsp;&nbsp;t w o</span>

        {stage === 'pick' && (
          <>
            <h3>snap together, from anywhere</h3>
            <p>open a private room, send your person the link — you both appear side by side in the same strip.</p>
            <button className="btn btn-primary big" onClick={host}>✨ create our room</button>
            <div className="or"><span>or paste a code</span></div>
            <div className="join-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="room code…"
                onKeyDown={(e) => e.key === 'Enter' && code.trim() && join(code)}
              />
              <button className="btn" disabled={!code.trim()} onClick={() => join(code)}>join</button>
            </div>
          </>
        )}

        {stage === 'hosting' && (
          <>
            <h3>room is open! 🎈</h3>
            <p>send this link to your favourite person:</p>
            <button className="link-box" onClick={copy} title="copy link">
              <span className="link-text">{roomLink(code)}</span>
              <span className="copy-chip">{copied ? '✓ copied' : 'copy'}</span>
            </button>
            <div className="waiting">
              <span className="pulse-dot" /> waiting for them to arrive…
            </div>
          </>
        )}

        {stage === 'joining' && (
          <>
            <h3>knocking on the booth door…</h3>
            <div className="waiting"><span className="pulse-dot" /> connecting to room <b>{code}</b></div>
          </>
        )}

        {stage === 'error' && (
          <>
            <h3>oh no 🥺</h3>
            <p className="err-text">{error}</p>
            <button className="btn btn-primary" onClick={() => { setError(''); setStage('pick'); }}>try again</button>
          </>
        )}

        <button className="btn btn-ghost mini" onClick={cancel}>← back</button>
      </div>

      <style jsx>{`
        .duo-overlay { position: absolute; inset: 0; z-index: 65; display: grid; place-items: center; background: rgba(107,79,79,0.38); backdrop-filter: blur(6px); padding: 16px; }
        .duo { position: relative; width: min(430px, 95%); padding: 26px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
        .duo-hearts { font-size: 2.6rem; animation: float-y 3s ease-in-out infinite; }
        .duo h3 { font-size: 1.45rem; color: var(--pink-deep); }
        .duo p { font-size: 0.92rem; line-height: 1.45; color: var(--brown); max-width: 320px; }
        .big { font-size: 1.1rem; padding: 0.8em 1.6em; }
        .or { display: flex; align-items: center; gap: 10px; width: 100%; color: var(--brown-soft); font-size: 0.78rem; font-weight: 700; }
        .or::before, .or::after { content: ''; flex: 1; border-top: 2px dashed var(--blush); }
        .join-row { display: flex; gap: 8px; width: 100%; }
        .join-row input { flex: 1; padding: 11px 14px; border: 2.5px dashed var(--pink); border-radius: 14px; background: var(--cream); color: var(--brown); text-align: center; font-weight: 700; letter-spacing: 0.08em; }
        .link-box { display: flex; align-items: center; gap: 8px; width: 100%; background: var(--cream); border: 2.5px dashed var(--pink); border-radius: 14px; padding: 10px 12px; }
        .link-text { flex: 1; font-size: 0.78rem; font-weight: 700; color: var(--brown); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .copy-chip { background: var(--pink); color: #fff; border-radius: 999px; padding: 4px 12px; font-size: 0.78rem; font-weight: 800; }
        .waiting { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--brown-soft); font-size: 0.9rem; }
        .pulse-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .err-text { color: #c0526b; font-weight: 700; }
        .mini { font-size: 0.8rem; padding: 0.4em 1em; }
      `}</style>
    </div>
  );
}
