'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCENTS, accentById } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { createRoom, joinRoom, makeRoomCode, roomLink, getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import { toast } from '@/components/ui/toast';

type Stage = 'pick' | 'hosting' | 'joining' | 'error';

/**
 * DuoLobby — open a room and share the 5-letter code, or enter one to join.
 * Rooms are ephemeral P2P: single-use codes, dead the moment a tab closes.
 * On connect both people land wherever `onConnected` points (booth by default).
 */
export function DuoLobby({ joinCode, onConnected, onClose }: {
  joinCode?: string | null;
  onConnected?: () => void;
  onClose: () => void;
}) {
  const accent = useBoothStore((s) => s.accent);
  const setAccent = useBoothStore((s) => s.setAccent);
  const setDuo = useBoothStore((s) => s.setDuo);
  const setPhase = useBoothStore((s) => s.setPhase);
  const [stage, setStage] = useState<Stage>(joinCode ? 'joining' : 'pick');
  const [code, setCode] = useState<string>(joinCode ?? '');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const enterTogether = useCallback((role: 'host' | 'guest', c: string) => {
    if (!getActiveRoom()) return;
    setDuo({ active: true, role, code: c, connected: true });
    play('success');
    if (onConnected) onConnected();
    else setPhase('capture');
  }, [setDuo, setPhase, onConnected]);

  // host flow
  const host = useCallback(async () => {
    const c = makeRoomCode();
    setCode(c);
    setStage('hosting');
    try {
      await createRoom(c); // resolves when a guest connects
      enterTogether('host', c);
    } catch (e) {
      setError((e as Error).message || 'could not open a room');
      setStage('error');
    }
  }, [enterTogether]);

  // guest flow (auto-run if arrived via link)
  const join = useCallback(async (c: string) => {
    setStage('joining');
    try {
      const clean = c.trim().toLowerCase();
      const room = await joinRoom(clean);
      await room.ready;
      enterTogether('guest', clean);
    } catch (e) {
      setError((e as Error).message || 'could not join — check the code');
      setStage('error');
    }
  }, [enterTogether]);

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
      toast('copy failed — share the code instead', 'err');
    }
  };

  const cancel = () => {
    getActiveRoom()?.destroy();
    onClose();
  };

  return (
    <div className="duo-overlay" role="dialog" aria-label="room for two">
      <div className="duo card grain">
        <div className="duo-hearts" aria-hidden>💞</div>
        <span className="label-spaced">r o o m&nbsp;&nbsp;f o r&nbsp;&nbsp;t w o</span>

        {stage === 'pick' && (
          <>
            <h3>meet in the middle, from anywhere</h3>
            <p>open a room and tell your person the 5-letter code — booth, games, everything works in the same room.</p>
            <div className="accent-row" role="radiogroup" aria-label="pick your color">
              <span className="accent-label">your color</span>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={accent === a.id}
                  title={a.label}
                  className={`swatch ${accent === a.id ? 'sel' : ''}`}
                  style={{ background: a.value }}
                  onClick={() => setAccent(a.id)}
                />
              ))}
            </div>
            <button className="btn btn-primary big" onClick={host}>✨ open a room</button>
            <div className="or"><span>or enter a code</span></div>
            <div className="join-row">
              <input
                value={code}
                maxLength={5}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z2-9]/g, ''))}
                placeholder="5 letters…"
                onKeyDown={(e) => e.key === 'Enter' && code.trim().length === 5 && join(code)}
              />
              <button className="btn" disabled={code.trim().length !== 5} onClick={() => join(code)}>join</button>
            </div>
          </>
        )}

        {stage === 'hosting' && (
          <>
            <h3>your room is open! 🎈</h3>
            <p>tell your person this code (or send the link):</p>
            <div className="code-big" aria-label={`room code ${code}`}>
              {code.split('').map((ch, i) => <span key={i}>{ch}</span>)}
            </div>
            <button className="link-box" onClick={copy} title="copy link">
              <span className="link-text">{roomLink(code)}</span>
              <span className="copy-chip">{copied ? '✓ copied' : 'copy'}</span>
            </button>
            <div className="waiting">
              <span className="pulse-dot" style={{ background: accentById(accent).value }} /> waiting for your person… ♡
            </div>
          </>
        )}

        {stage === 'joining' && (
          <>
            <h3>knocking on the door…</h3>
            <div className="waiting"><span className="pulse-dot" /> connecting to room <b>{code}</b></div>
          </>
        )}

        {stage === 'error' && (
          <>
            <h3>oh no 🥺</h3>
            <p className="err-text">{error}</p>
            <p className="err-tips">
              if this keeps happening: codes are single-use, so open a fresh room · try switching off a VPN ·
              if you’re on the same wifi, one of you can try mobile data (some networks block peer-to-peer).
            </p>
            <button className="btn btn-primary" onClick={() => { setError(''); setStage('pick'); }}>try again</button>
          </>
        )}

        <button className="btn btn-ghost mini" onClick={cancel}>← back</button>
      </div>

      <style jsx>{`
        .duo-overlay { position: absolute; inset: 0; z-index: 65; display: grid; place-items: center; background: rgba(107,79,79,0.38); backdrop-filter: blur(6px); padding: 16px; }
        .duo { position: relative; width: min(440px, 95%); padding: 26px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
        .duo-hearts { font-size: 2.6rem; animation: float-y 3s ease-in-out infinite; }
        .duo h3 { font-size: 1.45rem; color: var(--pink-deep); }
        .duo p { font-size: 0.92rem; line-height: 1.45; color: var(--brown); max-width: 330px; }
        .accent-row { display: flex; align-items: center; gap: 8px; }
        .accent-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; color: var(--brown-soft); margin-right: 2px; }
        .swatch { width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 0 2px rgba(107,79,79,0.25); transition: transform 0.12s ease; }
        .swatch.sel { transform: scale(1.25); box-shadow: 0 0 0 2.5px var(--brown); }
        .big { font-size: 1.1rem; padding: 0.8em 1.6em; }
        .or { display: flex; align-items: center; gap: 10px; width: 100%; color: var(--brown-soft); font-size: 0.78rem; font-weight: 700; }
        .or::before, .or::after { content: ''; flex: 1; border-top: 2px dashed var(--blush); }
        .join-row { display: flex; gap: 8px; width: 100%; }
        .join-row input { flex: 1; padding: 11px 14px; border: 2.5px dashed var(--pink); border-radius: 14px; background: var(--cream); color: var(--brown); text-align: center; font-weight: 800; letter-spacing: 0.35em; text-transform: lowercase; font-size: 1.05rem; }
        .code-big { display: flex; gap: 8px; }
        .code-big span { display: grid; place-items: center; width: 46px; height: 56px; background: var(--cream); border: 3px solid var(--brown); border-radius: 14px; font-family: var(--font-display); font-size: 1.7rem; font-weight: 800; color: var(--pink-deep); box-shadow: 3px 4px 0 var(--blush); }
        .link-box { display: flex; align-items: center; gap: 8px; width: 100%; background: var(--cream); border: 2.5px dashed var(--pink); border-radius: 14px; padding: 10px 12px; }
        .link-text { flex: 1; font-size: 0.78rem; font-weight: 700; color: var(--brown); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .copy-chip { background: var(--pink); color: #fff; border-radius: 999px; padding: 4px 12px; font-size: 0.78rem; font-weight: 800; }
        .waiting { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--brown-soft); font-size: 0.9rem; }
        .pulse-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .err-text { color: #c0526b; font-weight: 700; }
        .err-tips { font-size: 0.78rem !important; color: var(--brown-soft) !important; }
        .mini { font-size: 0.8rem; padding: 0.4em 1em; }
      `}</style>
    </div>
  );
}
