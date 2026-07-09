'use client';

/**
 * DrawActivity — one shared prompt, one canvas split in half. Host draws the
 * LEFT half, guest the RIGHT. Strokes stream live over the data channel but
 * the partner's half stays covered until the timed reveal — then each rates
 * the other's half out of 10 with a cute stamp, and the combined drawing can
 * be downloaded as a PNG (soft copy only, like everything here).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { canvasToBlob, downloadBlob, stampName, shareImage } from '@/lib/export/deliver';
import { play } from '@/lib/sound/sound';
import { toast } from '@/components/ui/toast';
import type { ActivityProps } from '../ActivityHost';

const PROMPTS = [
  'our dream house', 'the day we met', 'each other (no pressure)', 'our next holiday',
  'a two-headed creature', 'breakfast in bed', 'us as cartoon animals', 'the inside of my head',
  'our first date, from memory', 'a monster made of snacks', 'us at 80 years old', 'the weather in your heart',
];

const COLORS = ['#6b4f4f', '#ff8fab', '#7fb5f0', '#f0c060', '#7ed0a8', '#b79ced', '#ffffff'];
const SIZES = [3, 6, 12];
const DRAW_SECONDS = 90;
const W = 1000, H = 500;

interface Stroke { pts: number[]; c: string; w: number }

type Msg =
  | { k: 'prompt'; i: number }
  | { k: 'start' }
  | { k: 's'; s: Stroke }
  | { k: 'undo' }
  | { k: 'rate'; v: number }
  | { k: 'again' };

type Stage = 'lobby' | 'draw' | 'rate' | 'done';

const stampFor = (v: number) =>
  v >= 9 ? 'masterpiece 🏆' : v >= 7 ? 'gallery-worthy 🖼️' : v >= 5 ? 'adorable attempt 🎀' : 'very… abstract 😌';

export function DrawActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const [stage, setStage] = useState<Stage>('lobby');
  const [promptIdx, setPromptIdx] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(DRAW_SECONDS);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [myRating, setMyRating] = useState(7);
  const [ratings, setRatings] = useState<{ mine: number | null; theirs: number | null }>({ mine: null, theirs: null });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mine = useRef<Stroke[]>([]);
  const theirs = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const drawStroke = useCallback((c: CanvasRenderingContext2D, s: Stroke) => {
    if (s.pts.length < 4) {
      const x = s.pts[0] * W, y = s.pts[1] * H;
      c.fillStyle = s.c;
      c.beginPath(); c.arc(x, y, s.w / 2, 0, Math.PI * 2); c.fill();
      return;
    }
    c.strokeStyle = s.c;
    c.lineWidth = s.w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(s.pts[0] * W, s.pts[1] * H);
    for (let i = 2; i < s.pts.length; i += 2) c.lineTo(s.pts[i] * W, s.pts[i + 1] * H);
    c.stroke();
  }, []);

  const redraw = useCallback(() => {
    const c = ctx();
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    // faint seam down the middle
    c.fillStyle = '#ffd6e0';
    c.fillRect(W / 2 - 2, 0, 4, H);
    [...mine.current, ...theirs.current].forEach((s) => drawStroke(c, s));
    if (live.current) drawStroke(c, live.current);
  }, [drawStroke]);

  useEffect(() => { redraw(); }, [redraw, stage]);

  const send = useActivityChannel<Msg>('draw', (m) => {
    switch (m.k) {
      case 'prompt': setPromptIdx(m.i); play('pop'); break;
      case 'start': beginDraw(); break;
      case 's': {
        theirs.current.push(m.s);
        const c = ctx();
        if (c) drawStroke(c, m.s);
        break;
      }
      case 'undo': theirs.current.pop(); redraw(); break;
      case 'rate':
        setRatings((r) => ({ ...r, theirs: m.v }));
        break;
      case 'again': resetAll(); break;
    }
  });

  // both ratings in → done
  useEffect(() => {
    if (stage === 'rate' && ratings.mine !== null && ratings.theirs !== null) {
      setStage('done');
      play('success');
    }
  }, [ratings, stage]);

  const beginDraw = () => {
    setStage('draw');
    setTimeLeft(DRAW_SECONDS);
    play('success');
  };

  const resetAll = () => {
    mine.current = [];
    theirs.current = [];
    live.current = null;
    setPromptIdx(null);
    setRatings({ mine: null, theirs: null });
    setMyRating(7);
    setStage('lobby');
  };

  // countdown
  useEffect(() => {
    if (stage !== 'draw') return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setStage('rate');
          play('printer');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage]);

  // ── pointer drawing (own half only) ──
  const toNorm = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    // clamp to my half (host left, guest right)
    x = isHost ? Math.min(x, 0.498) : Math.max(x, 0.502);
    return [Math.min(1, Math.max(0, x)), y] as const;
  };

  const onDown = (e: React.PointerEvent) => {
    if (stageRef.current !== 'draw') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = toNorm(e);
    live.current = { pts: [x, y], c: color, w: size };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!live.current) return;
    const [x, y] = toNorm(e);
    live.current.pts.push(x, y);
    const c = ctx();
    if (c) {
      const p = live.current.pts;
      const n = p.length;
      if (n >= 4) {
        c.strokeStyle = live.current.c;
        c.lineWidth = live.current.w;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(p[n - 4] * W, p[n - 3] * H);
        c.lineTo(p[n - 2] * W, p[n - 1] * H);
        c.stroke();
      }
    }
  };
  const onUp = () => {
    if (!live.current) return;
    const s = live.current;
    live.current = null;
    mine.current.push(s);
    redraw();
    // one message per stroke keeps the wire cheap and replay exact
    send({ k: 's', s });
  };

  const undoMine = () => {
    mine.current.pop();
    redraw();
    send({ k: 'undo' });
    play('pop');
  };

  const exportPng = async (share: boolean) => {
    const src = canvasRef.current!;
    // compose with a cute frame + prompt caption
    const out = document.createElement('canvas');
    out.width = W + 80; out.height = H + 140;
    const c = out.getContext('2d')!;
    c.fillStyle = '#fff8f0';
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(src, 40, 40);
    c.strokeStyle = '#6b4f4f';
    c.lineWidth = 4;
    c.strokeRect(40, 40, W, H);
    c.fillStyle = '#6b4f4f';
    c.font = "700 34px 'Baloo 2', sans-serif";
    c.textAlign = 'center';
    c.fillText(`“${promptIdx !== null ? PROMPTS[promptIdx] : 'our drawing'}” — drawn together`, out.width / 2, H + 105);
    const blob = await canvasToBlob(out, 'image/png');
    if (share) {
      const ok = await shareImage(blob, stampName('png'));
      if (!ok) { downloadBlob(blob, stampName('png')); toast('sharing not supported — downloaded instead', 'info'); }
    } else {
      downloadBlob(blob, stampName('png'));
      toast('saved! ♡', 'ok');
    }
    play('success');
  };

  const drawPrompt = () => {
    const i = Math.floor(Math.random() * PROMPTS.length);
    setPromptIdx(i);
    send({ k: 'prompt', i });
    play('pop');
  };

  const min = Math.floor(timeLeft / 60);
  const sec = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="draw-wrap">
      {stage === 'lobby' && (
        <div className="d-lobby card grain">
          <div className="d-emoji">🎨</div>
          <h3>draw together</h3>
          <p>one prompt, one canvas — you each get a half. their side stays secret until the reveal!</p>
          {promptIdx === null ? (
            <button className="btn btn-primary" onClick={drawPrompt}>🎴 draw a prompt</button>
          ) : (
            <>
              <div className="prompt-chip">“{PROMPTS[promptIdx]}”</div>
              <div className="row">
                <button className="btn btn-ghost" onClick={drawPrompt}>↻ different one</button>
                <button className="btn btn-primary" onClick={() => { send({ k: 'start' }); beginDraw(); }}>
                  start · {DRAW_SECONDS}s
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage !== 'lobby' && (
        <>
          <div className="d-top">
            <span className="prompt-chip">“{promptIdx !== null ? PROMPTS[promptIdx] : ''}”</span>
            {stage === 'draw' && <span className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>{min}:{sec}</span>}
          </div>

          <div className="board">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
            {stage === 'draw' && (
              <div className={`cover ${isHost ? 'right' : 'left'}`}>
                <span>their half — hidden until the reveal ✨</span>
              </div>
            )}
            <div className={`side-tag mine ${isHost ? 'left' : 'right'}`}>you</div>
          </div>

          {stage === 'draw' && (
            <div className="tools card grain">
              {COLORS.map((c) => (
                <button key={c} className={`swatch ${color === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`color ${c}`} />
              ))}
              <span className="sep" />
              {SIZES.map((s) => (
                <button key={s} className={`sizedot ${size === s ? 'sel' : ''}`} onClick={() => setSize(s)} aria-label={`brush ${s}px`}>
                  <i style={{ width: s + 4, height: s + 4 }} />
                </button>
              ))}
              <span className="sep" />
              <button className="btn btn-ghost mini" onClick={undoMine}>↶ undo</button>
            </div>
          )}

          {stage === 'rate' && (
            <div className="rate card grain">
              {ratings.mine === null ? (
                <>
                  <h3>rate their half! ({isHost ? 'right side' : 'left side'})</h3>
                  <div className="slider-row">
                    <input type="range" min={0} max={10} value={myRating} onChange={(e) => setMyRating(Number(e.target.value))} />
                    <strong>{myRating}/10</strong>
                  </div>
                  <button className="btn btn-primary" onClick={() => { setRatings((r) => ({ ...r, mine: myRating })); send({ k: 'rate', v: myRating }); play('pop'); }}>
                    stamp it 🎀
                  </button>
                </>
              ) : (
                <div className="waiting"><span className="pulse-dot" /> waiting for their verdict…</div>
              )}
            </div>
          )}

          {stage === 'done' && (
            <div className="rate card grain">
              <h3>the verdicts are in!</h3>
              <div className="verdicts">
                <div><small>they gave your half</small><strong>{ratings.theirs}/10</strong><em>{stampFor(ratings.theirs ?? 0)}</em></div>
                <div><small>you gave their half</small><strong>{ratings.mine}/10</strong><em>{stampFor(ratings.mine ?? 0)}</em></div>
              </div>
              <div className="row">
                <button className="btn btn-primary" onClick={() => exportPng(false)}>⬇ save the drawing</button>
                <button className="btn btn-ghost" onClick={() => exportPng(true)}>↗ share</button>
                <button className="btn btn-ghost" onClick={() => { send({ k: 'again' }); resetAll(); }}>↻ again</button>
                <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic</button>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .draw-wrap { position: relative; width: min(760px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .d-lobby { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 28px; text-align: center; margin-top: 7vh; max-width: 400px; }
        .d-emoji { font-size: 2.6rem; }
        .d-lobby h3 { font-size: 1.4rem; color: var(--pink-deep); }
        .d-lobby p { font-size: 0.92rem; color: var(--brown); line-height: 1.45; }
        .prompt-chip { font-family: var(--font-hand); font-size: 1.15rem; color: var(--pink-deep); background: #fff; border: 2px dashed var(--pink); border-radius: 999px; padding: 6px 16px; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .d-top { display: flex; align-items: center; gap: 12px; justify-content: space-between; width: 100%; }
        .timer { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; color: var(--brown); background: #fff; border: 2.5px solid var(--brown); border-radius: 999px; padding: 2px 14px; box-shadow: var(--shadow-sm); }
        .timer.low { color: #fff; background: var(--pink-deep); animation: twinkle 0.9s ease-in-out infinite; }
        .board { position: relative; width: 100%; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-md); background: #fff; }
        .board canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; }
        .cover { position: absolute; top: 0; bottom: 0; width: 50%; display: grid; place-items: center; background: repeating-linear-gradient(45deg, #ffe9f0 0 18px, #fff3f7 18px 36px); border-left: 2px dashed var(--pink); }
        .cover.left { left: 0; border-left: none; border-right: 2px dashed var(--pink); }
        .cover.right { right: 0; }
        .cover span { font-weight: 800; color: var(--pink-deep); font-size: 0.8rem; text-align: center; padding: 0 16px; background: rgba(255,255,255,0.8); border-radius: 999px; padding: 6px 12px; }
        .side-tag { position: absolute; top: 8px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; background: var(--butter); border: 2px solid var(--brown); border-radius: 999px; padding: 2px 10px; }
        .side-tag.left { left: 10px; }
        .side-tag.right { right: 10px; }
        .tools { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 16px; flex-wrap: wrap; justify-content: center; }
        .swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px rgba(107,79,79,0.3); }
        .swatch.sel { transform: scale(1.25); box-shadow: 0 0 0 2.5px var(--brown); }
        .sep { width: 2px; height: 22px; background: var(--blush); border-radius: 2px; }
        .sizedot { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--brown); background: #fff; }
        .sizedot.sel { background: var(--butter); }
        .sizedot i { display: block; border-radius: 50%; background: var(--brown); }
        .rate { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 22px; text-align: center; width: 100%; }
        .rate h3 { font-size: 1.15rem; color: var(--pink-deep); }
        .slider-row { display: flex; align-items: center; gap: 12px; width: min(320px, 90%); }
        .slider-row input { flex: 1; accent-color: var(--pink); }
        .slider-row strong { font-family: var(--font-display); font-size: 1.2rem; color: var(--brown); min-width: 54px; }
        .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .verdicts { display: flex; gap: 22px; }
        .verdicts > div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .verdicts small { font-size: 0.7rem; font-weight: 700; color: var(--brown-soft); }
        .verdicts strong { font-family: var(--font-display); font-size: 1.8rem; color: var(--pink-deep); }
        .verdicts em { font-style: normal; font-size: 0.78rem; font-weight: 700; color: var(--brown); }
        .mini { font-size: 0.78rem; padding: 0.35em 0.9em; }
      `}</style>
    </div>
  );
}
