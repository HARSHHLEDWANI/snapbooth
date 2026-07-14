'use client';

/**
 * HangoutActivity — "the hangout": the do-anything room. No rules, no scores;
 * both webcams stay up and a toolbelt of small shared tools syncs over the
 * one data channel: shared canvas (two live cursors), shared notepad,
 * decision wheel, dice + coin, image roulette (lib/images), and a launcher
 * into every other activity without dropping the room. Everything is
 * session-only; close the tab and the whole hangout evaporates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { useBoothStore, type ActivityId } from '@/store/useBoothStore';
import { accentById } from '@/config/app';
import { play } from '@/lib/sound/sound';
import { IMAGE_CATEGORIES, categoryById, getRandomImages } from '@/lib/images/images';
import { SyncedImage } from '@/lib/images/SyncedImage';
import { canvasToBlob, downloadBlob, stampName } from '@/lib/export/deliver';
import { toast } from '@/components/ui/toast';
import type { ActivityProps } from '../ActivityHost';

type Tool = 'canvas' | 'notepad' | 'wheel' | 'dice' | 'roulette' | 'launcher';

interface Seg { x0: number; y0: number; x1: number; y1: number; c: string; w: number }

type Msg =
  | { k: 'tool'; tool: Tool }
  | { k: 'cv-seg'; s: Seg }
  | { k: 'cv-clear' }
  | { k: 'cur'; x: number; y: number }
  | { k: 'note'; text: string }
  | { k: 'wheel-opts'; opts: string }
  | { k: 'wheel-spin'; target: number; turns: number }
  | { k: 'dice'; v: number }
  | { k: 'coin'; v: 'heads' | 'tails' }
  | { k: 'img'; url: string; cat: string }
  | { k: 'img-req'; cat: string };

const TOOLS: { id: Tool; emoji: string; label: string }[] = [
  { id: 'canvas', emoji: '🖍️', label: 'canvas' },
  { id: 'notepad', emoji: '📝', label: 'notepad' },
  { id: 'wheel', emoji: '🎡', label: 'wheel' },
  { id: 'dice', emoji: '🎲', label: 'dice' },
  { id: 'roulette', emoji: '🖼️', label: 'roulette' },
  { id: 'launcher', emoji: '🚀', label: 'play' },
];

const LAUNCH: { a: ActivityId; emoji: string; label: string }[] = [
  { a: 'quiz', emoji: '💭', label: 'know-me quiz' },
  { a: 'decide', emoji: '🤝', label: 'we decide' },
  { a: 'pick', emoji: '🖼️', label: 'who’d pick this?' },
  { a: 'draw', emoji: '🎨', label: 'draw together' },
  { a: 'debate', emoji: '👑', label: 'debate club' },
  { a: 'arcade', emoji: '🕹️', label: 'arcade' },
  { a: 'rope', emoji: '🎀', label: 'tied together' },
];

const CANVAS_W = 1000;
const CANVAS_H = 640;
const WHEEL_COLORS = ['#FF8FAB', '#BDE0FE', '#FFE8A3', '#7ED0A8', '#B79CED', '#FFD6E0'];

export function HangoutActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const accent = useBoothStore((s) => s.accent);
  const partnerAccent = useBoothStore((s) => s.duo.partnerAccent);
  const myColor = accentById(accent).value;
  const theirColor = accentById(partnerAccent ?? (accent === 'pink' ? 'blue' : 'pink')).value;

  const [tool, setTool] = useState<Tool>('canvas');

  // cams
  const localVid = useRef<HTMLVideoElement | null>(null);
  const remoteVid = useRef<HTMLVideoElement | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);

  // canvas
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const segs = useRef<Seg[]>([]);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [erase, setErase] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const lastCursorSend = useRef(0);

  // notepad
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // wheel
  const [wheelOptsText, setWheelOptsText] = useState('pizza night\nmovie marathon\ncall + long walk\ncook the same dish');
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dice + coin
  const [die, setDie] = useState<number | null>(null);
  const [coin, setCoin] = useState<'heads' | 'tails' | null>(null);
  const [tumbling, setTumbling] = useState<'dice' | 'coin' | null>(null);

  // roulette
  const [rImg, setRImg] = useState<{ url: string; cat: string } | null>(null);
  const [rBusy, setRBusy] = useState(false);

  // ── camera ──
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
      } catch { /* hangout works without cameras too */ }
    })();
    return () => { dead = true; myStream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── canvas plumbing ──
  const paintSeg = useCallback((s: Seg) => {
    const ctx = cvRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = s.c === 'erase' ? 'destination-out' : 'source-over';
    if (s.c === 'erase') { ctx.strokeStyle = '#000'; ctx.lineWidth = s.w * 4; }
    ctx.beginPath();
    ctx.moveTo(s.x0 * CANVAS_W, s.y0 * CANVAS_H);
    ctx.lineTo(s.x1 * CANVAS_W, s.y1 * CANVAS_H);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  const repaint = useCallback(() => {
    const ctx = cvRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    segs.current.forEach(paintSeg);
  }, [paintSeg]);

  // canvas element mounts/unmounts when switching tools — repaint history
  useEffect(() => { if (tool === 'canvas') repaint(); }, [tool, repaint]);

  const send = useActivityChannel<Msg>('hangout', (m) => {
    switch (m.k) {
      case 'tool': setTool(m.tool); play('pop'); break;
      case 'cv-seg': segs.current.push(m.s); paintSeg(m.s); break;
      case 'cv-clear': segs.current = []; repaint(); break;
      case 'cur': setCursor({ x: m.x, y: m.y }); break;
      case 'note':
        // last-writer-wins; don't clobber mid-keystroke
        if (document.activeElement !== noteRef.current) setNote(m.text);
        break;
      case 'wheel-opts': setWheelOptsText(m.opts); break;
      case 'wheel-spin': runSpin(m.target, m.turns, false); break;
      case 'dice': runDice(m.v, false); break;
      case 'coin': runCoin(m.v, false); break;
      case 'img': setRImg({ url: m.url, cat: m.cat }); setRBusy(false); play('pop'); break;
      case 'img-req': if (isHost) resolveRoulette(m.cat, false); break;
    }
  });

  const switchTool = (t: Tool) => {
    setTool(t);
    send({ k: 'tool', tool: t });
    play('pop');
  };

  const canvasPos = (e: React.PointerEvent): { x: number; y: number } => {
    const r = cvRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onCanvasDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    lastPt.current = canvasPos(e);
  };

  const onCanvasMove = (e: React.PointerEvent) => {
    const p = canvasPos(e);
    const now = performance.now();
    if (now - lastCursorSend.current > 33) {
      lastCursorSend.current = now;
      send({ k: 'cur', x: p.x, y: p.y });
    }
    if (!drawing.current || !lastPt.current) return;
    const s: Seg = { x0: lastPt.current.x, y0: lastPt.current.y, x1: p.x, y1: p.y, c: erase ? 'erase' : myColor, w: 4 / CANVAS_W * 1000 };
    lastPt.current = p;
    segs.current.push(s);
    paintSeg(s);
    send({ k: 'cv-seg', s });
  };

  const onCanvasUp = () => { drawing.current = false; lastPt.current = null; };

  const clearCanvas = () => {
    segs.current = [];
    repaint();
    send({ k: 'cv-clear' });
    play('pop');
  };

  const exportCanvas = async () => {
    const out = document.createElement('canvas');
    out.width = CANVAS_W * 2; out.height = CANVAS_H * 2;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.scale(2, 2);
    if (cvRef.current) ctx.drawImage(cvRef.current, 0, 0);
    downloadBlob(await canvasToBlob(out), stampName('png'));
    toast('canvas saved ♡');
    play('success');
  };

  // ── notepad ──
  const onNote = (text: string) => {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => send({ k: 'note', text }), 350);
  };

  // ── wheel ──
  const wheelOpts = wheelOptsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8);

  const runSpin = (target: number, turns: number, broadcast: boolean) => {
    if (broadcast) send({ k: 'wheel-spin', target, turns });
    const seg = 360 / Math.max(1, wheelOpts.length);
    setSpinning(true);
    setWheelResult(null);
    // pointer is at the top; rotate so `target`'s middle lands under it
    setWheelAngle(turns * 360 + (360 - (target * seg + seg / 2)));
    play('whir');
    setTimeout(() => {
      setSpinning(false);
      setWheelResult(wheelOpts[target] ?? '?');
      play('success');
    }, 3200);
  };

  const spin = () => {
    if (spinning || wheelOpts.length < 2) return;
    runSpin(Math.floor(Math.random() * wheelOpts.length), 4 + Math.floor(Math.random() * 3), true);
  };

  const onWheelOpts = (text: string) => {
    setWheelOptsText(text);
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => send({ k: 'wheel-opts', opts: text }), 350);
  };

  // ── dice + coin ──
  const runDice = (v: number, broadcast: boolean) => {
    if (broadcast) send({ k: 'dice', v });
    setTumbling('dice');
    play('whir');
    setTimeout(() => { setTumbling(null); setDie(v); play('pop'); }, 900);
  };
  const runCoin = (v: 'heads' | 'tails', broadcast: boolean) => {
    if (broadcast) send({ k: 'coin', v });
    setTumbling('coin');
    play('whir');
    setTimeout(() => { setTumbling(null); setCoin(v); play('pop'); }, 900);
  };

  // ── roulette ──
  const resolveRoulette = async (cat: string, broadcastReq: boolean) => {
    if (broadcastReq) { send({ k: 'img-req', cat }); setRBusy(true); return; }
    setRBusy(true);
    const [url] = await getRandomImages(cat, 1);
    send({ k: 'img', url, cat });
    setRImg({ url, cat });
    setRBusy(false);
    play('pop');
  };

  const pullImage = (cat: string) => {
    if (rBusy) return;
    if (isHost) resolveRoulette(cat, false);
    else resolveRoulette(cat, true);
  };

  // ── launcher ──
  const launch = (a: ActivityId) => {
    play('pop');
    getActiveRoom()?.send({ t: 'open-activity', a });
    useBoothStore.getState().openActivity(a);
  };

  const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <div className="hang-wrap">
      {/* cams — always up; this room is about being together */}
      <div className="cams">
        <div className="cam" style={{ borderColor: myColor }}>
          <video ref={localVid} playsInline autoPlay muted />
          {!camOn && <span className="nocam">📷 camera off</span>}
          <span className="cam-tag">you</span>
        </div>
        <div className="cam" style={{ borderColor: theirColor }}>
          <video ref={remoteVid} playsInline autoPlay muted />
          <span className="cam-tag">them</span>
        </div>
      </div>

      {/* toolbelt */}
      <div className="belt" role="tablist" aria-label="hangout tools">
        {TOOLS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tool === t.id} className={`belt-btn ${tool === t.id ? 'on' : ''}`} onClick={() => switchTool(t.id)}>
            <span>{t.emoji}</span><small>{t.label}</small>
          </button>
        ))}
      </div>

      {/* tool area */}
      <div className="area card grain">
        {tool === 'canvas' && (
          <div className="cv-tool">
            <div className="cv-frame">
              <canvas
                ref={cvRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onPointerDown={onCanvasDown}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerLeave={onCanvasUp}
              />
              {cursor && (
                <span className="ghost-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, background: theirColor }} />
              )}
            </div>
            <div className="cv-bar">
              <button className={`btn mini ${!erase ? 'btn-primary' : ''}`} onClick={() => setErase(false)}>🖍️ draw</button>
              <button className={`btn mini ${erase ? 'btn-primary' : ''}`} onClick={() => setErase(true)}>🧽 erase</button>
              <span className="spacer" />
              <button className="btn mini" onClick={exportCanvas}>⬇ save</button>
              <button className="btn mini btn-ghost" onClick={clearCanvas}>clear</button>
            </div>
          </div>
        )}

        {tool === 'notepad' && (
          <div className="note-tool">
            <span className="hint-line">one notepad between you — plans, lists, little notes. gone when the room closes.</span>
            <textarea
              ref={noteRef}
              value={note}
              placeholder={'tonight:\n– …'}
              onChange={(e) => onNote(e.target.value)}
              onBlur={() => send({ k: 'note', text: note })}
            />
          </div>
        )}

        {tool === 'wheel' && (
          <div className="wheel-tool">
            <div className="wheel-side">
              <span className="hint-line">options, one per line (max 8)</span>
              <textarea value={wheelOptsText} onChange={(e) => onWheelOpts(e.target.value)} />
            </div>
            <div className="wheel-stage">
              <div className="pointer" aria-hidden>▼</div>
              <div
                className="wheel"
                style={{
                  transform: `rotate(${wheelAngle}deg)`,
                  transition: spinning ? 'transform 3.2s cubic-bezier(0.12, 0.7, 0.16, 1)' : 'none',
                  background: `conic-gradient(${wheelOpts.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${(i / wheelOpts.length) * 360}deg ${((i + 1) / wheelOpts.length) * 360}deg`).join(', ')})`,
                }}
              >
                {wheelOpts.map((o, i) => {
                  const seg = 360 / wheelOpts.length;
                  return (
                    <span key={i} className="wedge-label" style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-38%)` }}>
                      {o.length > 14 ? o.slice(0, 13) + '…' : o}
                    </span>
                  );
                })}
              </div>
              <button className="btn btn-primary" disabled={spinning || wheelOpts.length < 2} onClick={spin}>
                {spinning ? 'spinning…' : '🎡 spin together'}
              </button>
              {wheelResult && <div className="wheel-result">the wheel says: <b>{wheelResult}</b> ✨</div>}
            </div>
          </div>
        )}

        {tool === 'dice' && (
          <div className="dice-tool">
            <div className="dc-stage">
              <div className={`die ${tumbling === 'dice' ? 'tumble' : ''}`}>{die ? DICE_FACES[die - 1] : '🎲'}</div>
              <button className="btn btn-primary" disabled={tumbling !== null} onClick={() => runDice(1 + Math.floor(Math.random() * 6), true)}>roll</button>
            </div>
            <div className="dc-stage">
              <div className={`die coin ${tumbling === 'coin' ? 'tumble' : ''}`}>{coin === 'heads' ? '🙂' : coin === 'tails' ? '🪙' : '🪙'}</div>
              <button className="btn btn-primary" disabled={tumbling !== null} onClick={() => runCoin(Math.random() < 0.5 ? 'heads' : 'tails', true)}>flip</button>
              {coin && tumbling !== 'coin' && <span className="dc-result">{coin}!</span>}
            </div>
            <p className="hint-line">same roll on both screens — invent any game you like ♡</p>
          </div>
        )}

        {tool === 'roulette' && (
          <div className="rou-tool">
            <div className="rou-cats">
              {IMAGE_CATEGORIES.map((c) => (
                <button key={c.id} className="btn mini" disabled={rBusy} onClick={() => pullImage(c.id)}>{c.emoji} {c.label}</button>
              ))}
            </div>
            <div className="rou-stage">
              {rBusy && <div className="waiting"><span className="pulse-dot" /> pulling a picture…</div>}
              {!rBusy && rImg && (
                <>
                  <div className="rou-img"><SyncedImage src={rImg.url} alt="conversation prompt" /></div>
                  <p className="rou-prompt">{categoryById(rImg.cat).prompt}</p>
                </>
              )}
              {!rBusy && !rImg && <p className="hint-line">pull a random picture as a conversation prompt — rate it, argue about it, adopt it.</p>}
            </div>
          </div>
        )}

        {tool === 'launcher' && (
          <div className="launch-tool">
            <span className="hint-line">jump anywhere — the room comes with you.</span>
            <div className="launch-grid">
              <button className="launch-btn hero" onClick={onBoothPic}><span>📸</span><small>the photobooth</small></button>
              {LAUNCH.map((l) => (
                <button key={l.a} className="launch-btn" onClick={() => launch(l.a)}><span>{l.emoji}</span><small>{l.label}</small></button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .hang-wrap { position: relative; width: min(860px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 0; }
        .cams { display: flex; gap: 10px; justify-content: center; }
        .cam { position: relative; width: min(220px, 40vw); aspect-ratio: 4/3; background: #2b2320; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
        .cam video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .cam-tag { position: absolute; bottom: 6px; left: 8px; background: rgba(255,255,255,0.85); border-radius: 999px; padding: 1px 10px; font-size: 0.7rem; font-weight: 800; color: var(--brown); }
        .nocam { position: absolute; inset: 0; display: grid; place-items: center; color: var(--blush); font-weight: 700; font-size: 0.85rem; }
        .belt { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .belt-btn { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 6px 14px; background: rgba(255,255,255,0.8); border: 2.5px solid var(--brown); border-radius: 14px; box-shadow: var(--shadow-sm); transition: transform 0.12s ease; }
        .belt-btn:hover { transform: translateY(-2px); }
        .belt-btn.on { background: var(--butter); border-style: dashed; }
        .belt-btn span { font-size: 1.2rem; }
        .belt-btn small { font-size: 0.62rem; font-weight: 800; color: var(--brown); }
        .area { position: relative; width: 100%; flex: 1; min-height: 280px; padding: 14px; display: flex; }
        .hint-line { font-size: 0.78rem; font-weight: 700; color: var(--brown-soft); text-align: center; }
        .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); margin: auto; }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }

        .cv-tool { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .cv-frame { position: relative; width: 100%; border: 2.5px dashed var(--pink); border-radius: 14px; overflow: hidden; background: #fff; }
        .cv-frame canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; }
        .ghost-cursor { position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; transform: translate(-50%, -50%); pointer-events: none; box-shadow: var(--shadow-sm); }
        .cv-bar { display: flex; gap: 6px; align-items: center; }
        .cv-bar .spacer { flex: 1; }
        .mini { font-size: 0.78rem; padding: 0.4em 1em; }

        .note-tool { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .note-tool textarea { flex: 1; min-height: 240px; resize: none; background: repeating-linear-gradient(#fff, #fff 30px, #ffeef4 31px); border: 2.5px dashed var(--pink); border-radius: 14px; padding: 14px 16px; font-family: var(--font-hand, inherit); font-size: 1.05rem; line-height: 31px; color: var(--brown); }

        .wheel-tool { display: flex; gap: 16px; width: 100%; align-items: stretch; flex-wrap: wrap; justify-content: center; }
        .wheel-side { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 190px; }
        .wheel-side textarea { flex: 1; min-height: 170px; resize: none; border: 2.5px dashed var(--pink); border-radius: 14px; padding: 10px 12px; font-weight: 700; font-size: 0.88rem; color: var(--brown); background: #fff; }
        .wheel-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .pointer { font-size: 1.3rem; color: var(--brown); margin-bottom: -8px; z-index: 2; }
        .wheel { position: relative; width: 210px; height: 210px; border-radius: 50%; border: 4px solid var(--brown); box-shadow: var(--shadow-md); overflow: hidden; }
        .wedge-label { position: absolute; left: 50%; top: 50%; transform-origin: 0 0; font-size: 0.6rem; font-weight: 800; color: #6b4f4f; white-space: nowrap; }
        .wheel-result { font-weight: 800; color: var(--brown); }
        .wheel-result b { color: var(--pink-deep); }

        .dice-tool { display: flex; gap: 26px; align-items: center; justify-content: center; width: 100%; flex-wrap: wrap; }
        .dc-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .die { font-size: 4rem; line-height: 1; }
        .die.coin { font-size: 3.4rem; }
        .die.tumble { animation: tumble 0.18s linear infinite; }
        @keyframes tumble { 50% { transform: rotate(24deg) scale(1.15); } }
        .dc-result { font-weight: 800; color: var(--pink-deep); }

        .rou-tool { display: flex; flex-direction: column; gap: 10px; width: 100%; }
        .rou-cats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .rou-stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 180px; }
        .rou-img { width: min(420px, 92%); aspect-ratio: 4/3; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-md); }
        .rou-prompt { font-family: var(--font-hand, inherit); font-size: 1.15rem; color: var(--brown); font-weight: 700; }

        .launch-tool { display: flex; flex-direction: column; gap: 12px; width: 100%; align-items: center; }
        .launch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; width: 100%; }
        .launch-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; background: var(--cream); border: 2.5px solid var(--brown); border-radius: 16px; box-shadow: var(--shadow-sm); transition: transform 0.12s ease; }
        .launch-btn:hover { transform: translateY(-3px); }
        .launch-btn.hero { background: var(--blush); }
        .launch-btn span { font-size: 1.7rem; }
        .launch-btn small { font-size: 0.72rem; font-weight: 800; color: var(--brown); }

        @media (max-width: 560px) { .cam { width: 44vw; } .area { padding: 10px; } }
      `}</style>
    </div>
  );
}
