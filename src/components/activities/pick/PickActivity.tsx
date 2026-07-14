'use client';

/**
 * PickActivity — "who'd pick this?": the random-image guessing game.
 * Each round the CHOOSER picks a category; the HOST resolves 4 random
 * internet images (lib/images sync rule) and broadcasts the URLs so both
 * screens show identical pictures. The chooser secretly favorites one; the
 * guesser bets which. Correct = point + streak bonus; wrong = the chooser
 * gets 15 seconds on camera to defend their taste. Roles swap every round,
 * best of 10. Every image actually chosen composites into a "dream board"
 * collage exported through the shared delivery pipeline.
 */

import { useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import { IMAGE_CATEGORIES, categoryById, getRandomImages, preloadImages, loadCorsImage } from '@/lib/images/images';
import { SyncedImage } from '@/lib/images/SyncedImage';
import { canvasToBlob, downloadBlob, shareImage, stampName } from '@/lib/export/deliver';
import { toast } from '@/components/ui/toast';
import { APP_NAME } from '@/config/app';
import type { ActivityProps } from '../ActivityHost';

const ROUNDS = 10;
const IMAGES_PER_ROUND = 4;
const DEFEND_SECONDS = 15;
const REVEAL_MS = 2600;
const STREAK_FOR_BONUS = 3;

type Msg =
  | { k: 'cat'; r: number; cat: string }        // chooser announces the category
  | { k: 'imgs'; r: number; urls: string[] }    // HOST broadcasts resolved urls
  | { k: 'choose'; r: number; i: number }
  | { k: 'guess'; r: number; i: number }
  | { k: 'again' };

type Stage = 'lobby' | 'cat' | 'loading' | 'play' | 'reveal' | 'defend' | 'done';

export function PickActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const [stage, setStage] = useState<Stage>('lobby');
  const [round, setRound] = useState(0);
  const [catId, setCatId] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [myIdx, setMyIdx] = useState<number | null>(null);   // my choose OR my guess this round
  const [timer, setTimer] = useState(0);
  const [scores, setScores] = useState({ host: 0, guest: 0 });
  const [streaks, setStreaks] = useState({ host: 0, guest: 0 });
  const [bonusFlash, setBonusFlash] = useState(false);
  const [hit, setHit] = useState(false);
  const [chosen, setChosen] = useState<{ url: string; cat: string }[]>([]); // dream board fuel
  const [exporting, setExporting] = useState(false);

  const chooses = useRef(new Map<number, number>());
  const guesses = useRef(new Map<number, number>());

  const localVid = useRef<HTMLVideoElement | null>(null);
  const remoteVid = useRef<HTMLVideoElement | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);

  const roundRef = useRef(round); roundRef.current = round;
  const urlsRef = useRef(urls); urlsRef.current = urls;

  // chooser alternates every round; host chooses first
  const chooser: 'host' | 'guest' = round % 2 === 0 ? 'host' : 'guest';
  const iChoose = role === chooser;

  // best-effort camera for defend rounds
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
      } catch { /* fine */ }
    })();
    return () => { dead = true; myStream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const send = useActivityChannel<Msg>('pick', (m) => {
    if (m.k === 'cat') {
      setCatId(m.cat);
      setStage('loading');
      // the HOST resolves images for everyone, whoever chose the category
      if (isHost) resolveImages(m.r, m.cat);
    } else if (m.k === 'imgs') {
      beginRound(m.r, m.urls);
    } else if (m.k === 'choose') {
      chooses.current.set(m.r, m.i);
      maybeReveal(m.r);
    } else if (m.k === 'guess') {
      guesses.current.set(m.r, m.i);
      maybeReveal(m.r);
    } else if (m.k === 'again') {
      resetAll();
    }
  });

  const resolveImages = async (r: number, cat: string) => {
    const list = await getRandomImages(cat, IMAGES_PER_ROUND);
    send({ k: 'imgs', r, urls: list });
    beginRound(r, list);
  };

  const beginRound = (r: number, list: string[]) => {
    setRound(r);
    setUrls(list);
    setMyIdx(null);
    setHit(false);
    setStage('play');
    play('pop');
  };

  const chooseCategory = (cat: string) => {
    setCatId(cat);
    setStage('loading');
    play('pop');
    send({ k: 'cat', r: round, cat });
    if (isHost) resolveImages(round, cat);
  };

  const pickImage = (i: number) => {
    if (myIdx !== null || stage !== 'play') return;
    setMyIdx(i);
    play('pop');
    if (iChoose) {
      chooses.current.set(round, i);
      send({ k: 'choose', r: round, i });
    } else {
      guesses.current.set(round, i);
      send({ k: 'guess', r: round, i });
    }
    setTimeout(() => maybeReveal(roundRef.current), 0);
  };

  const maybeReveal = (r: number) => {
    if (r !== roundRef.current) return;
    const c = chooses.current.get(r);
    const g = guesses.current.get(r);
    if (c === undefined || g === undefined) return;

    const correct = c === g;
    setHit(correct);
    setStage('reveal');
    play(correct ? 'success' : 'pop');

    // the guesser this round is the NON-chooser
    const guesser: 'host' | 'guest' = r % 2 === 0 ? 'guest' : 'host';
    if (correct) {
      setStreaks((s) => {
        const ns = { ...s, [guesser]: s[guesser] + 1 };
        const bonus = ns[guesser] > 0 && ns[guesser] % STREAK_FOR_BONUS === 0;
        setScores((sc) => ({ ...sc, [guesser]: sc[guesser] + 1 + (bonus ? 1 : 0) }));
        if (bonus) { setBonusFlash(true); setTimeout(() => setBonusFlash(false), 2000); }
        return ns;
      });
    } else {
      setStreaks((s) => ({ ...s, [guesser]: 0 }));
    }
    // remember what the chooser actually chose, for the dream board
    setChosen((list) => [...list, { url: urlsRef.current[c], cat: catId ?? '' }]);
    // warm the next round's category grid feel by preloading current fallbacks
    preloadImages(urlsRef.current);

    setTimeout(() => {
      if (correct) advance(r);
      else { setStage('defend'); setTimer(DEFEND_SECONDS); }
    }, REVEAL_MS);
  };

  const advance = (r: number) => {
    const next = r + 1;
    if (next >= ROUNDS) { setStage('done'); play('success'); return; }
    setRound(next);
    setCatId(null);
    setMyIdx(null);
    setStage('cat');
  };

  useEffect(() => {
    if (stage !== 'defend') return;
    const iv = setInterval(() => {
      setTimer((t) => {
        if (t > 1) return t - 1;
        clearInterval(iv);
        advance(roundRef.current);
        return 0;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const resetAll = () => {
    setStage('lobby');
    setRound(0);
    setCatId(null);
    setUrls([]);
    setMyIdx(null);
    setScores({ host: 0, guest: 0 });
    setStreaks({ host: 0, guest: 0 });
    setChosen([]);
    chooses.current.clear();
    guesses.current.clear();
  };

  // ── dream board export ────────────────────────────────────────────────
  const renderDreamBoard = async (): Promise<HTMLCanvasElement> => {
    const COLS = 5, TILE = 300, GAP = 14, PAD = 46, HEAD = 110;
    const rows = Math.max(1, Math.ceil(chosen.length / COLS));
    const W = PAD * 2 + COLS * TILE + (COLS - 1) * GAP;
    const H = HEAD + PAD * 2 + rows * (TILE * 0.75) + (rows - 1) * GAP;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FF8FAB';
    ctx.font = '800 52px "Comic Sans MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('our dream board', W / 2, 74);

    const imgs = await Promise.all(chosen.map((ch) => loadCorsImage(ch.url)));
    chosen.forEach((ch, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = PAD + col * (TILE + GAP);
      const y = HEAD + PAD + row * (TILE * 0.75 + GAP);
      const w = TILE, h = TILE * 0.75;
      const img = imgs[i];
      if (img) {
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const sw = w / s, sh = h / s;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
      } else {
        ctx.fillStyle = ['#FFD6E0', '#FFE8A3', '#BDE0FE'][i % 3];
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#6B4F4F';
        ctx.font = '40px "Segoe UI", sans-serif';
        ctx.fillText(categoryById(ch.cat).emoji, x + w / 2, y + h / 2 + 14);
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, w, h);
    });

    const d = new Date();
    ctx.fillStyle = '#a58585';
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillText(`♡ ${APP_NAME} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ♡`, W / 2, H - 26);
    return c;
  };

  const exportBoard = async (mode: 'download' | 'share') => {
    setExporting(true);
    try {
      const blob = await canvasToBlob(await renderDreamBoard());
      const name = stampName('png');
      if (mode === 'share') {
        const ok = await shareImage(blob, name);
        if (!ok) { downloadBlob(blob, name); toast('sharing not supported — downloaded instead ♡'); }
      } else {
        downloadBlob(blob, name);
        toast('dream board saved ♡');
      }
      play('success');
    } catch {
      toast('could not export — try again?', 'err');
    } finally {
      setExporting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────
  const cat = catId ? categoryById(catId) : null;
  const myScore = isHost ? scores.host : scores.guest;
  const theirScore = isHost ? scores.guest : scores.host;
  const showCams = stage === 'defend';
  const iDefend = stage === 'defend' && iChoose;

  return (
    <div className="pick-wrap">
      {stage !== 'lobby' && stage !== 'done' && (
        <div className="progress">
          <span>round {round + 1} / {ROUNDS}</span>
          <span className="score">you {myScore} — {theirScore} them</span>
        </div>
      )}
      {bonusFlash && <div className="bonus">🔥 streak bonus +1!</div>}

      <div className={`cams ${showCams ? '' : 'hidden'}`}>
        <div className={`cam ${iDefend ? 'live' : ''}`}><video ref={localVid} playsInline autoPlay muted />{!camOn && <span className="nocam">📷 camera off</span>}<span className="cam-tag">you</span></div>
        <div className={`cam ${!iDefend ? 'live' : ''}`}><video ref={remoteVid} playsInline autoPlay muted /><span className="cam-tag">them</span></div>
      </div>

      {stage === 'lobby' && (
        <div className="panel card grain">
          <div className="big-emoji">🖼️</div>
          <h3>who’d pick this?</h3>
          <p>4 random pictures from the internet land on both screens. one of you secretly picks a favorite; the other bets on which. wrong guess? taste must be DEFENDED. {ROUNDS} rounds.</p>
          {isHost
            ? <button className="btn btn-primary" onClick={() => setStage('cat')}>let’s play</button>
            : <div className="waiting"><span className="pulse-dot" /> waiting for your person to start…</div>}
        </div>
      )}

      {stage === 'cat' && (
        <div className="panel card grain">
          {iChoose ? (
            <>
              <span className="chip">your round to choose — pick a category</span>
              <div className="cats">
                {IMAGE_CATEGORIES.map((c) => (
                  <button key={c.id} className="cat-btn" onClick={() => chooseCategory(c.id)}>
                    <span>{c.emoji}</span><small>{c.label}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="waiting"><span className="pulse-dot" /> they’re picking a category…</div>
          )}
        </div>
      )}

      {stage === 'loading' && (
        <div className="panel card grain">
          <div className="waiting"><span className="pulse-dot" /> summoning {cat ? `${cat.emoji} ${cat.label}` : 'pictures'} from the internet…</div>
        </div>
      )}

      {(stage === 'play' || stage === 'reveal' || stage === 'defend') && urls.length > 0 && (
        <>
          <p className="prompt">
            {stage === 'play'
              ? iChoose ? `${cat?.emoji} pick your secret favorite` : `${cat?.emoji} ${cat?.prompt ?? 'which would they pick?'}`
              : stage === 'reveal'
                ? hit ? 'NAILED IT ✨ you two share a brain' : 'so wrong. so, so wrong 💅'
                : iDefend ? `defend your taste! ${timer}s 🎙️` : `they have ${timer}s to explain… themselves 👂`}
          </p>
          <div className="grid">
            {urls.map((u, i) => {
              const revealChosen = stage !== 'play' && chooses.current.get(round) === i;
              const revealGuess = stage !== 'play' && guesses.current.get(round) === i;
              return (
                <button
                  key={`${round}-${i}`}
                  className={`tile ${myIdx === i && stage === 'play' ? 'sel' : ''} ${revealChosen ? 'chosen' : ''} ${revealGuess && !revealChosen ? 'missed' : ''}`}
                  disabled={stage !== 'play' || myIdx !== null}
                  onClick={() => pickImage(i)}
                >
                  <SyncedImage src={u} alt={`option ${i + 1}`} />
                  {revealChosen && <span className="badge">their pick ♡</span>}
                  {revealGuess && !revealChosen && <span className="badge miss">the bet ✗</span>}
                </button>
              );
            })}
          </div>
          {stage === 'play' && myIdx !== null && <div className="waiting"><span className="pulse-dot" /> locked in — waiting for them…</div>}
        </>
      )}

      {stage === 'done' && (
        <div className="panel card grain">
          <div className="big-emoji">{myScore === theirScore ? '🤝' : (myScore > theirScore) ? '🏆' : '💐'}</div>
          <h3>{myScore === theirScore ? 'perfectly matched taste-readers' : myScore > theirScore ? 'you read them like a book!' : 'they know you a little too well'}</h3>
          <p>final score: you {myScore} — {theirScore} them</p>
          <div className="row">
            <button className="btn btn-primary" disabled={exporting || chosen.length === 0} onClick={() => exportBoard('download')}>⬇ dream board</button>
            <button className="btn" disabled={exporting || chosen.length === 0} onClick={() => exportBoard('share')}>share</button>
            <button className="btn btn-ghost" onClick={() => { send({ k: 'again' }); resetAll(); }}>play again</button>
            <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pick-wrap { position: relative; width: min(700px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .progress { display: flex; justify-content: space-between; width: 100%; font-weight: 800; color: var(--brown); font-size: 0.85rem; }
        .progress .score { color: var(--pink-deep); }
        .bonus { position: absolute; top: 24px; z-index: 6; background: var(--butter); border: 2.5px solid var(--brown); border-radius: 999px; padding: 6px 18px; font-weight: 800; color: var(--brown); animation: float-y 1s ease-in-out infinite; box-shadow: var(--shadow-md); }
        .cams { display: flex; gap: 10px; width: 100%; justify-content: center; }
        .cams.hidden { display: none; }
        .cam { position: relative; width: min(250px, 42vw); aspect-ratio: 4/3; background: #2b2320; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
        .cam.live { border-color: var(--pink-deep); box-shadow: 0 0 0 3px var(--blush), var(--shadow-md); }
        .cam video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .cam-tag { position: absolute; bottom: 6px; left: 8px; background: rgba(255,255,255,0.85); border-radius: 999px; padding: 1px 10px; font-size: 0.7rem; font-weight: 800; color: var(--brown); }
        .nocam { position: absolute; inset: 0; display: grid; place-items: center; color: var(--blush); font-weight: 700; font-size: 0.85rem; }
        .panel { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 22px; text-align: center; }
        .panel h3 { font-size: 1.3rem; color: var(--brown); }
        .panel p { font-size: 0.9rem; color: var(--brown); max-width: 440px; }
        .big-emoji { font-size: 2.4rem; }
        .chip { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; border-radius: 999px; padding: 4px 14px; border: 2px dashed var(--pink); color: var(--pink-deep); background: #fff; }
        .cats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
        .cat-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 86px; padding: 10px 4px; background: var(--cream); border: 2.5px solid var(--brown); border-radius: 14px; box-shadow: var(--shadow-sm); transition: transform 0.12s ease; }
        .cat-btn:hover { transform: translateY(-3px); }
        .cat-btn span { font-size: 1.5rem; }
        .cat-btn small { font-size: 0.64rem; font-weight: 800; color: var(--brown); }
        .prompt { font-weight: 800; color: var(--brown); font-size: 0.95rem; text-align: center; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
        .tile { position: relative; aspect-ratio: 4/3; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; padding: 0; background: var(--blush); box-shadow: var(--shadow-sm); transition: transform 0.12s ease; }
        .tile:hover:not(:disabled) { transform: translateY(-3px); }
        .tile.sel { border-color: var(--pink-deep); box-shadow: 0 0 0 3px var(--blush), var(--shadow-md); }
        .tile.chosen { border-color: #3f9d68; box-shadow: 0 0 0 3px #d8f5e3, var(--shadow-md); }
        .tile.missed { opacity: 0.85; border-style: dashed; }
        .badge { position: absolute; top: 8px; left: 8px; background: #3f9d68; color: #fff; border-radius: 999px; padding: 2px 12px; font-size: 0.72rem; font-weight: 800; }
        .badge.miss { background: var(--pink-deep); }
        .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); font-size: 0.85rem; }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        @media (max-width: 480px) { .grid { gap: 8px; } }
      `}</style>
    </div>
  );
}
