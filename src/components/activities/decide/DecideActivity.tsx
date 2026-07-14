'use client';

/**
 * DecideActivity — "we decide": the consensus quiz.
 * Both people get the SAME question, lock in privately, reveal together.
 * Match → confetti + it goes on the record. Mismatch → a 30-second on-camera
 * "convince me" round, then a timed joint re-vote; if you still disagree it's
 * lovingly recorded as "agreed to disagree". At the end every verdict is
 * composited into a photo-strip-styled MANIFESTO CARD and exported through
 * the shared delivery pipeline. Humans decide everything; nothing persists.
 */

import { useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import { canvasToBlob, downloadBlob, shareImage, stampName } from '@/lib/export/deliver';
import { toast } from '@/components/ui/toast';
import { APP_NAME } from '@/config/app';
import type { ActivityProps } from '../ActivityHost';
import { DECIDE_QUESTIONS } from './questions';

const ROUND_COUNT = 8;          // questions per game (deck is bigger; host deals)
const REVEAL_MS = 2400;
const CONVINCE_SECONDS = 30;
const REVOTE_SECONDS = 15;

type Msg =
  | { k: 'deal'; qs: number[] }                 // host deals question indices
  | { k: 'pick'; q: number; choice: number }    // first vote
  | { k: 'revote'; q: number; choice: number }  // vote after convincing
  | { k: 'again' };

type Stage = 'lobby' | 'play' | 'reveal' | 'convince' | 'revote' | 'rereveal' | 'done';

/** verdict per question: agreed choice, or both picks if agree-to-disagree */
type Verdict = { agreed: number } | { mine: number; theirs: number };

export function DecideActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const [stage, setStage] = useState<Stage>('lobby');
  const [deck, setDeck] = useState<number[]>([]);
  const [q, setQ] = useState(0);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const theirPicks = useRef(new Map<number, number>());
  const theirRevotes = useRef(new Map<number, number>());
  const [matched, setMatched] = useState(false);
  const [exporting, setExporting] = useState(false);

  const localVid = useRef<HTMLVideoElement | null>(null);
  const remoteVid = useRef<HTMLVideoElement | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);

  const stageRef = useRef(stage); stageRef.current = stage;
  const qRef = useRef(q); qRef.current = q;
  const myPickRef = useRef(myPick); myPickRef.current = myPick;
  const deckRef = useRef(deck); deckRef.current = deck;

  // best-effort camera for the convince-me rounds (game works without it)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: false });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        myStream.current = stream;
        if (localVid.current) { localVid.current.srcObject = stream; localVid.current.play().catch(() => {}); }
        setCamOn(true);
        const room = getActiveRoom();
        room?.attachStream(stream);
        room?.onRemoteStream((s) => {
          if (remoteVid.current && remoteVid.current.srcObject !== s) {
            remoteVid.current.srcObject = s;
            remoteVid.current.play().catch(() => {});
          }
        });
      } catch { /* camera denied — timers still run */ }
    })();
    return () => { dead = true; myStream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const send = useActivityChannel<Msg>('decide', (m) => {
    if (m.k === 'deal') {
      startGame(m.qs);
    } else if (m.k === 'pick') {
      theirPicks.current.set(m.q, m.choice);
      maybeReveal(m.q, false);
    } else if (m.k === 'revote') {
      theirRevotes.current.set(m.q, m.choice);
      maybeReveal(m.q, true);
    } else if (m.k === 'again') {
      setStage('lobby');
    }
  });

  const startGame = (qs: number[]) => {
    setDeck(qs);
    setQ(0);
    setMyPick(null);
    setVerdicts([]);
    theirPicks.current.clear();
    theirRevotes.current.clear();
    advancedFor.current = -1;
    setStage('play');
    play('pop');
  };

  const deal = () => {
    const idx = DECIDE_QUESTIONS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const qs = idx.slice(0, ROUND_COUNT);
    send({ k: 'deal', qs });
    startGame(qs);
  };

  const maybeReveal = (forQ: number, isRevote: boolean) => {
    if (forQ !== qRef.current || myPickRef.current === null) return;
    const theirs = (isRevote ? theirRevotes : theirPicks).current.get(forQ);
    if (theirs === undefined) return;
    const mine = myPickRef.current;
    const hit = mine === theirs;
    setMatched(hit);
    setStage(isRevote ? 'rereveal' : 'reveal');
    play(hit ? 'success' : 'pop');
    setTimeout(() => {
      if (hit) {
        recordVerdict({ agreed: mine });
      } else if (!isRevote) {
        setStage('convince');
        setTimer(CONVINCE_SECONDS);
      } else {
        recordVerdict({ mine, theirs });
      }
    }, REVEAL_MS);
  };

  // guards recordVerdict against double-fire (React StrictMode, or the
  // revote-timeout racing the reveal path) — one verdict + advance per question
  const advancedFor = useRef(-1);

  const recordVerdict = (v: Verdict) => {
    const cur = qRef.current;
    if (advancedFor.current === cur) return;
    advancedFor.current = cur;
    setVerdicts((list) => (list.length > cur ? list : [...list, v]));
    const next = cur + 1;
    if (next >= deckRef.current.length) {
      setStage('done');
      play('success');
    } else {
      setQ(next);
      setMyPick(null);
      setStage('play');
    }
  };

  // convince / revote countdowns — the tick is a pure decrement; stage
  // transitions live outside the updater so StrictMode can't double-run them
  useEffect(() => {
    if (stage !== 'convince' && stage !== 'revote') return;
    const iv = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => {
    if (timer !== 0) return;
    if (stage === 'convince') {
      setMyPick(null);
      setStage('revote');
      setTimer(REVOTE_SECONDS);
      play('countdown');
    } else if (stage === 'revote') {
      // revote clock ran out — whatever is locked (or not) becomes the verdict
      const mine = myPickRef.current;
      const theirs = theirRevotes.current.get(qRef.current);
      if (mine !== null && theirs !== undefined) return; // reveal already handled it
      recordVerdict({
        mine: mine ?? theirPicks.current.get(qRef.current) ?? 0,
        theirs: theirs ?? theirPicks.current.get(qRef.current) ?? 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, stage]);

  const pick = (i: number) => {
    if (myPick !== null) return;
    setMyPick(i);
    play('pop');
    if (stageRef.current === 'revote') {
      send({ k: 'revote', q, choice: i });
      setTimeout(() => maybeReveal(qRef.current, true), 0);
    } else {
      send({ k: 'pick', q, choice: i });
      setTimeout(() => maybeReveal(qRef.current, false), 0);
    }
  };

  // ── the manifesto card ────────────────────────────────────────────────
  const renderManifesto = (): HTMLCanvasElement => {
    const W = 900, PAD = 56, LINE = 96;
    const H = PAD * 2 + 150 + verdicts.length * LINE + 110;
    const c = document.createElement('canvas');
    c.width = W * 2; c.height = H * 2;                 // 2x for print quality
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);

    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#FF8FAB';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.setLineDash([]);

    ctx.fillStyle = '#FF8FAB';
    ctx.font = '800 44px "Comic Sans MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('our little manifesto', W / 2, PAD + 44);
    ctx.fillStyle = '#a58585';
    ctx.font = '700 17px "Segoe UI", sans-serif';
    ctx.fillText('d e c i d e d   t o g e t h e r ,   f o r   t h e   r e c o r d', W / 2, PAD + 76);

    let y = PAD + 140;
    ctx.textAlign = 'left';
    verdicts.forEach((v, i) => {
      const question = DECIDE_QUESTIONS[deck[i]];
      ctx.fillStyle = '#6B4F4F';
      ctx.font = '700 19px "Segoe UI", sans-serif';
      ctx.fillText(`${question.emoji}  ${question.q}`, PAD, y);
      if ('agreed' in v) {
        ctx.fillStyle = '#2e7d4f';
        ctx.font = '800 22px "Segoe UI", sans-serif';
        ctx.fillText(`☑  ${question.options[v.agreed]}`, PAD + 34, y + 34);
      } else {
        ctx.fillStyle = '#b23a5c';
        ctx.font = '800 20px "Segoe UI", sans-serif';
        ctx.fillText(`🤍  we agree to disagree (${question.options[v.mine]} vs ${question.options[v.theirs]})`, PAD + 34, y + 34);
      }
      y += LINE;
    });

    const d = new Date();
    const stamp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    ctx.fillStyle = '#a58585';
    ctx.font = '700 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`♡ ${APP_NAME} · ${stamp} ♡`, W / 2, H - PAD + 6);
    return c;
  };

  const exportManifesto = async (mode: 'download' | 'share') => {
    setExporting(true);
    try {
      const blob = await canvasToBlob(renderManifesto());
      const name = stampName('png');
      if (mode === 'share') {
        const ok = await shareImage(blob, name);
        if (!ok) { downloadBlob(blob, name); toast('sharing not supported — downloaded instead ♡'); }
      } else {
        downloadBlob(blob, name);
        toast('manifesto saved ♡');
      }
      play('success');
    } catch {
      toast('could not export — try again?', 'err');
    } finally {
      setExporting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────
  const agreedCount = verdicts.filter((v) => 'agreed' in v).length;
  const question = deck.length ? DECIDE_QUESTIONS[deck[q]] : null;
  const showCams = stage === 'convince';

  return (
    <div className="dec-wrap">
      {stage !== 'lobby' && stage !== 'done' && (
        <div className="progress">
          <span>{q + 1} / {deck.length}</span>
          <span className="score">☑ {agreedCount} agreed</span>
        </div>
      )}

      {/* cameras only surface during the convince round */}
      <div className={`cams ${showCams ? '' : 'hidden'}`}>
        <div className="cam"><video ref={localVid} playsInline autoPlay muted />{!camOn && <span className="nocam">📷 camera off</span>}<span className="cam-tag">you</span></div>
        <div className="cam"><video ref={remoteVid} playsInline autoPlay muted /><span className="cam-tag">them</span></div>
      </div>

      {stage === 'lobby' && (
        <div className="panel card grain">
          <div className="big-emoji">🤝</div>
          <h3>we decide</h3>
          <p>the same question hits both screens. lock in secretly, reveal together — agree and it goes on the record. disagree, and someone has 30 seconds to change a mind…</p>
          {isHost
            ? <button className="btn btn-primary" onClick={deal}>🎴 deal the questions</button>
            : <div className="waiting"><span className="pulse-dot" /> your person deals the questions…</div>}
        </div>
      )}

      {(stage === 'play' || stage === 'revote') && question && (
        <div className="panel card grain">
          {stage === 'revote' && <span className="chip re">re-vote! {timer}s — did they convince you?</span>}
          <div className="big-emoji">{question.emoji}</div>
          <h3>{question.q}</h3>
          <div className="opts">
            {question.options.map((o, i) => (
              <button key={i} className={`opt ${myPick === i ? 'sel' : ''}`} disabled={myPick !== null} onClick={() => pick(i)}>{o}</button>
            ))}
          </div>
          {myPick !== null && <div className="waiting"><span className="pulse-dot" /> locked in — waiting for them…</div>}
        </div>
      )}

      {(stage === 'reveal' || stage === 'rereveal') && question && (
        <div className="panel card grain">
          <div className={`verdict ${matched ? 'yay' : 'aw'}`}>
            {matched ? 'AGREED! it’s official ✨' : stage === 'reveal' ? 'a split decision…! 👀' : 'agreed to disagree 🤍'}
          </div>
          <p className="reveal-line">
            you: <b>{question.options[myPick ?? 0]}</b> · them: <b>{question.options[(stage === 'rereveal' ? theirRevotes : theirPicks).current.get(q) ?? 0]}</b>
          </p>
        </div>
      )}

      {stage === 'convince' && question && (
        <div className="panel card grain">
          <span className="chip">🎙️ convince-me round</span>
          <h3>{question.q}</h3>
          <p>you disagreed! make your case on camera — both of you. re-vote in <b className={timer <= 10 ? 'low' : ''}>{timer}s</b></p>
        </div>
      )}

      {stage === 'done' && (
        <div className="panel card grain">
          <div className="big-emoji">📜</div>
          <h3>the record is complete</h3>
          <p>{agreedCount} of {verdicts.length} decided as one — {agreedCount === verdicts.length ? 'terrifyingly compatible 💍' : agreedCount >= verdicts.length / 2 ? 'a solid coalition ♡' : 'chaos government, but a cute one 🫶'}</p>
          <div className="row">
            <button className="btn btn-primary" disabled={exporting} onClick={() => exportManifesto('download')}>⬇ manifesto card</button>
            <button className="btn" disabled={exporting} onClick={() => exportManifesto('share')}>share</button>
            <button className="btn btn-ghost" onClick={() => { send({ k: 'again' }); setStage('lobby'); }}>play again</button>
            <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .dec-wrap { position: relative; width: min(620px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .progress { display: flex; justify-content: space-between; width: 100%; font-weight: 800; color: var(--brown); font-size: 0.85rem; }
        .progress .score { color: #2e7d4f; }
        .cams { display: flex; gap: 10px; width: 100%; justify-content: center; }
        .cams.hidden { display: none; }
        .cam { position: relative; width: min(280px, 44vw); aspect-ratio: 4/3; background: #2b2320; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
        .cam video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .cam-tag { position: absolute; bottom: 6px; left: 8px; background: rgba(255,255,255,0.85); border-radius: 999px; padding: 1px 10px; font-size: 0.7rem; font-weight: 800; color: var(--brown); }
        .nocam { position: absolute; inset: 0; display: grid; place-items: center; color: var(--blush); font-weight: 700; font-size: 0.85rem; }
        .panel { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 22px; text-align: center; }
        .panel h3 { font-size: 1.3rem; color: var(--brown); }
        .panel p { font-size: 0.9rem; color: var(--brown); max-width: 430px; }
        .big-emoji { font-size: 2.4rem; }
        .chip { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; border-radius: 999px; padding: 4px 14px; border: 2px dashed var(--pink); color: var(--pink-deep); background: #fff; }
        .chip.re { border-color: #f0a840; color: #b97a17; }
        .opts { display: grid; grid-template-columns: 1fr; gap: 8px; width: min(380px, 100%); }
        .opt { border: 2.5px solid var(--brown); background: var(--cream); border-radius: 14px; padding: 12px; font-weight: 700; font-size: 0.9rem; color: var(--brown); box-shadow: var(--shadow-sm); transition: transform 0.1s ease; }
        .opt:hover:not(:disabled) { transform: translateY(-2px); }
        .opt.sel { background: var(--butter); border-style: dashed; }
        .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); font-size: 0.85rem; }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .verdict { font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; }
        .verdict.yay { color: #3f9d68; }
        .verdict.aw { color: var(--pink-deep); }
        .reveal-line b { color: var(--pink-deep); }
        b.low { animation: twinkle 0.8s ease-in-out infinite; color: #b23a5c; }
        .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
      `}</style>
    </div>
  );
}
