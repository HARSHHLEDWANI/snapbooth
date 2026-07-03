'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useBoothStore, type Shot } from '@/store/useBoothStore';
import { useCamera } from '@/lib/capture/useCamera';
import { usePreviewPipeline } from '@/lib/capture/usePreviewPipeline';
import { grabRawFrame, renderFilteredToDataURL } from '@/lib/capture/frameGrab';
import { getActiveRoom, combineFrames, downscaleForWire, type DuoMessage } from '@/lib/duo/room';
import { play } from '@/lib/sound/sound';
import { prefersReducedMotion } from '@/lib/device';
import { FilterRail } from './FilterRail';
import { ModeDial } from './ModeDial';
import { CameraError } from './CameraError';
import { BurstSelect } from './BurstSelect';
import { GifResult } from './GifResult';
import { PrintTransition } from './PrintTransition';
import { TopBar } from '@/components/ui/TopBar';

const InteriorScene = dynamic(() => import('@/components/booth3d/InteriorScene'), { ssr: false });

type Sub = 'idle' | 'running' | 'burst-select' | 'burst-wait' | 'gif-encoding' | 'gif-result' | 'printing';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CaptureView() {
  const { videoRef, status, error, cameras, start, flip } = useCamera();
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenHostRef = useRef<HTMLDivElement | null>(null);

  const store = useBoothStore;
  const mode = useBoothStore((s) => s.captureMode);
  const mirror = useBoothStore((s) => s.mirror);
  const liteMode = useBoothStore((s) => s.liteMode);
  const countdownSeconds = useBoothStore((s) => s.countdownSeconds);
  const shots = useBoothStore((s) => s.shots);
  const duo = useBoothStore((s) => s.duo);
  const setCountdown = useBoothStore((s) => s.setCountdown);
  const addShot = useBoothStore((s) => s.addShot);
  const replaceLastShot = useBoothStore((s) => s.replaceLastShot);
  const setShots = useBoothStore((s) => s.setShots);
  const clearShots = useBoothStore((s) => s.clearShots);
  const setBurstPool = useBoothStore((s) => s.setBurstPool);
  const setBoomerang = useBoothStore((s) => s.setBoomerang);
  const setPhase = useBoothStore((s) => s.setPhase);

  const [sub, setSub] = useState<Sub>('idle');
  const [glKey, setGlKey] = useState(0); // bumped to remount the 3D scene after a context loss
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [countNum, setCountNum] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [smile, setSmile] = useState(0);
  const [gifProgress, setGifProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const numRef = useRef<HTMLDivElement | null>(null);
  const reduced = useRef(false);
  const subRef = useRef<Sub>('idle');
  subRef.current = sub;

  const { canvasRef: previewCanvasRef } = usePreviewPipeline(videoRef, remoteVideoRef, status === 'ready' || duo.connected);

  // partner frames arriving over the wire, keyed by shot index
  const remoteFrames = useRef<Map<number, string>>(new Map());
  const remoteWaiters = useRef<Map<number, (s: string) => void>>(new Map());

  // ── camera + duo stream wiring ──
  useEffect(() => {
    reduced.current = prefersReducedMotion();
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !duo.connected) return;
    const room = getActiveRoom();
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (room && stream) room.attachStream(stream);
    room?.onRemoteStream((s) => {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== s) {
        remoteVideoRef.current.srcObject = s;
        remoteVideoRef.current.play().catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, duo.connected]);

  // recover from GPU context loss by remounting the 3D scene (throttled)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let last = 0;
    const onLost = (e: Event) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last > 3000) {
        last = now;
        setTimeout(() => setGlKey((k) => k + 1), 400);
      }
    };
    el.addEventListener('webglcontextlost', onLost, true);
    return () => el.removeEventListener('webglcontextlost', onLost, true);
  }, []);

  // lite mode: mount the preview canvas into the DOM screen
  useEffect(() => {
    if (!liteMode) return;
    const host = screenHostRef.current;
    const canvas = previewCanvasRef.current;
    if (host && canvas && !host.contains(canvas)) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover';
      host.appendChild(canvas);
    }
  }, [liteMode, previewCanvasRef, status]);

  // ── shared helpers ──
  const doFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }, []);

  const popNumber = useCallback(async (n: number) => {
    setCountNum(n);
    play('countdown');
    await new Promise<void>((resolve) => {
      if (reduced.current || !numRef.current) { setTimeout(resolve, 750); return; }
      gsap.fromTo(numRef.current,
        { scale: 0.3, y: -24, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.34, ease: 'elastic.out(1, 0.5)',
          onComplete: () => gsap.to(numRef.current, { scale: 0.86, opacity: 0, duration: 0.24, delay: 0.4, onComplete: resolve }) });
    });
  }, []);

  const countdown = useCallback(async (secs: number) => {
    for (let n = secs; n >= 1; n--) {
      if (n <= 3) await popNumber(n);
      else { setCountNum(n); play('countdown'); await wait(750); }
    }
    setCountNum(null);
  }, [popNumber]);

  const pushThumb = useCallback((raw: string) => {
    renderFilteredToDataURL(raw, { filterId: store.getState().filterId })
      .then((t) => setThumbs((p) => [...p, t]))
      .catch(() => setThumbs((p) => [...p, raw]));
  }, []);

  const snapLocal = useCallback((): { dataURL: string; width: number; height: number } => {
    doFlash();
    play('shutter');
    return grabRawFrame(videoRef.current!, store.getState().mirror);
  }, [doFlash]);

  const finish = useCallback(() => setSub('printing'), []);

  const waitRemoteFrame = useCallback((index: number, timeout = 12000): Promise<string | null> => {
    const have = remoteFrames.current.get(index);
    if (have) return Promise.resolve(have);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { remoteWaiters.current.delete(index); resolve(null); }, timeout);
      remoteWaiters.current.set(index, (s) => { clearTimeout(timer); resolve(s); });
    });
  }, []);

  const makeCombined = useCallback(async (index: number, localRaw: string): Promise<Shot> => {
    const room = getActiveRoom();
    const isHost = store.getState().duo.role === 'host';
    const wire = await downscaleForWire(localRaw);
    room?.send({ t: 'frame', index, jpeg: wire });
    setNote('waiting for your friend’s shot…');
    const partner = await waitRemoteFrame(index);
    setNote(null);
    const combined = await combineFrames(isHost ? wire : partner, isHost ? partner : wire);
    return { id: crypto.randomUUID(), sourceDataURL: combined.dataURL, width: combined.width, height: combined.height };
  }, [waitRemoteFrame]);

  // ── capture sequences ──
  const runTimed = useCallback(async (n: number, isDuo: boolean) => {
    setSub('running');
    for (let i = 0; i < n; i++) {
      await countdown(store.getState().countdownSeconds);
      const raw = snapLocal();
      if (isDuo) {
        const shot = await makeCombined(i, raw.dataURL);
        addShot(shot);
        pushThumb(shot.sourceDataURL);
      } else {
        addShot({ id: crypto.randomUUID(), sourceDataURL: raw.dataURL, width: raw.width, height: raw.height });
        pushThumb(raw.dataURL);
      }
      play('whir');
      await wait(550);
    }
    finish();
  }, [countdown, snapLocal, makeCombined, addShot, pushThumb, finish]);

  const runBurst = useCallback(async (isDuo: boolean) => {
    setSub('running');
    await countdown(store.getState().countdownSeconds);
    const locals: string[] = [];
    for (let i = 0; i < 8; i++) {
      const raw = snapLocal();
      locals.push(raw.dataURL);
      if (isDuo) downscaleForWire(raw.dataURL).then((w) => getActiveRoom()?.send({ t: 'frame', index: i, jpeg: w }));
      await wait(300);
    }
    const pool: Shot[] = [];
    if (isDuo) {
      setNote('mixing your shots together…');
      const isHost = store.getState().duo.role === 'host';
      for (let i = 0; i < 8; i++) {
        const wire = await downscaleForWire(locals[i]);
        const partner = await waitRemoteFrame(i);
        const combined = await combineFrames(isHost ? wire : partner, isHost ? partner : wire);
        pool.push({ id: `burst-${i}`, sourceDataURL: combined.dataURL, width: combined.width, height: combined.height });
      }
      setNote(null);
      setBurstPool(pool);
      // host picks for both; guest waits for the pick
      if (isHost) setSub('burst-select');
      else setSub('burst-wait');
    } else {
      for (let i = 0; i < 8; i++) {
        const img = new Image();
        await new Promise((res) => { img.onload = res; img.src = locals[i]; });
        pool.push({ id: `burst-${i}`, sourceDataURL: locals[i], width: img.naturalWidth, height: img.naturalHeight });
      }
      setBurstPool(pool);
      setSub('burst-select');
    }
  }, [countdown, snapLocal, waitRemoteFrame, setBurstPool]);

  const runBoomerang = useCallback(async () => {
    setSub('running');
    await countdown(Math.min(store.getState().countdownSeconds, 3));
    const src = previewCanvasRef.current!;
    const frames: { data: Uint8ClampedArray; width: number; height: number }[] = [];
    const rw = 320;
    const rh = Math.round((src.height / src.width) * rw);
    const rec = document.createElement('canvas');
    rec.width = rw; rec.height = rh;
    const rctx = rec.getContext('2d')!;
    play('whir');
    for (let i = 0; i < 22; i++) {
      rctx.drawImage(src, 0, 0, rw, rh);
      frames.push({ data: rctx.getImageData(0, 0, rw, rh).data, width: rw, height: rh });
      await wait(70);
    }
    doFlash();
    play('shutter');
    setSub('gif-encoding');
    setGifProgress(0);
    const worker = new Worker(new URL('../../lib/export/gif.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'progress') setGifProgress(d.value);
      if (d.type === 'done') {
        setBoomerang(URL.createObjectURL(new Blob([d.bytes], { type: 'image/gif' })));
        setSub('gif-result');
        worker.terminate();
        play('success');
      }
    };
    worker.postMessage({ type: 'encode', frames, delay: 70, boomerang: true }, frames.map((f) => f.data.buffer));
  }, [countdown, doFlash, setBoomerang, previewCanvasRef]);

  const runSmile = useCallback(async () => {
    setSub('running');
    setNote('loading smile detector…');
    let detector;
    try {
      const { loadSmileDetector } = await import('@/lib/capture/smile');
      detector = await loadSmileDetector();
      setNote(null);
    } catch {
      setNote("couldn't load smile mode — using a timer instead ♡");
      await wait(1200);
      setNote(null);
      await runTimed(4, false);
      return;
    }
    let held = 0;
    for (let i = 0; i < 4; i++) {
      held = 0;
      for (;;) {
        const s = detector.score(videoRef.current!, performance.now());
        setSmile(s);
        if (s > 0.4) held += 60; else held = Math.max(0, held - 40);
        if (held >= 600) break;
        await wait(60);
        if (store.getState().phase !== 'capture') { detector.close(); return; }
      }
      setSmile(0);
      const raw = snapLocal();
      addShot({ id: crypto.randomUUID(), sourceDataURL: raw.dataURL, width: raw.width, height: raw.height });
      pushThumb(raw.dataURL);
      await wait(700);
    }
    detector.close();
    finish();
  }, [runTimed, snapLocal, addShot, pushThumb, finish]);

  const beginSequence = useCallback((m: typeof mode, isDuo: boolean) => {
    clearShots();
    setThumbs([]);
    remoteFrames.current.clear();
    if (m === 'boomerang') runBoomerang();
    else if (m === 'burst') runBurst(isDuo);
    else if (m === 'smile') runSmile();
    else runTimed(m === 'single' ? 1 : 4, isDuo);
  }, [clearShots, runBoomerang, runBurst, runSmile, runTimed]);

  const startCapture = useCallback(() => {
    if (subRef.current !== 'idle' || status !== 'ready') return;
    play('pop');
    const st = store.getState();
    const isDuo = st.duo.connected;
    if (isDuo) {
      getActiveRoom()?.send({ t: 'capture-start', mode: st.captureMode, countdown: st.countdownSeconds, shots: st.captureMode === 'single' ? 1 : 4 });
    }
    beginSequence(st.captureMode, isDuo);
  }, [status, beginSequence]);

  // ── duo message handling ──
  useEffect(() => {
    const room = getActiveRoom();
    if (!room || !duo.connected) return;
    const off = room.on((msg: DuoMessage) => {
      if (msg.t === 'frame') {
        remoteFrames.current.set(msg.index, msg.jpeg);
        const w = remoteWaiters.current.get(msg.index);
        if (w) { remoteWaiters.current.delete(msg.index); w(msg.jpeg); }
      } else if (msg.t === 'capture-start' && subRef.current === 'idle') {
        useBoothStore.getState().setMode(msg.mode);
        useBoothStore.getState().setCountdown(msg.countdown as 3 | 5 | 10);
        beginSequence(msg.mode, true);
      } else if (msg.t === 'filter') {
        filterSyncGuard.current = true;
        useBoothStore.getState().setFilter(msg.id);
        filterSyncGuard.current = false;
      } else if (msg.t === 'burst-pick') {
        const pool = useBoothStore.getState().burstPool;
        setShots(msg.indices.map((i) => pool[i]).filter(Boolean));
        setSub('printing');
      }
    });
    return off;
  }, [duo.connected, beginSequence, setShots]);

  // filter selection sync (shared vibe in duo)
  const filterSyncGuard = useRef(false);
  useEffect(() => {
    if (!duo.connected) return;
    const unsub = useBoothStore.subscribe((s, prev) => {
      if (s.filterId !== prev.filterId && !filterSyncGuard.current) {
        getActiveRoom()?.send({ t: 'filter', id: s.filterId });
      }
    });
    return unsub;
  }, [duo.connected]);

  const retakeLast = useCallback(async () => {
    if (!shots.length || sub !== 'running' || duo.connected) return;
    const raw = snapLocal();
    replaceLastShot({ id: crypto.randomUUID(), sourceDataURL: raw.dataURL, width: raw.width, height: raw.height });
    const t = await renderFilteredToDataURL(raw.dataURL, { filterId: store.getState().filterId }).catch(() => raw.dataURL);
    setThumbs((p) => [...p.slice(0, -1), t]);
  }, [shots.length, sub, duo.connected, snapLocal, replaceLastShot]);

  // keyboard: space = shutter, arrows = filters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); startCapture(); }
      else if (e.code === 'ArrowRight') useBoothStore.getState().cycleFilter(1);
      else if (e.code === 'ArrowLeft') useBoothStore.getState().cycleFilter(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startCapture]);

  const busy = sub !== 'idle';
  const use3D = !liteMode;

  return (
    <div className="booth-interior">
      {/* hidden media elements — the local video MUST be mounted for the
          camera stream to play; both are consumed via canvas, never shown */}
      <video ref={videoRef} playsInline autoPlay muted style={{ display: 'none' }} />
      <video ref={remoteVideoRef} playsInline autoPlay muted style={{ display: 'none' }} />

      {/* stage: 3D interior or lite 2D screen */}
      <div className="stage3d" ref={stageRef}>
        {use3D && previewCanvasRef.current && (
          <InteriorScene key={glKey} screenSource={previewCanvasRef.current} flashOn={flash} lowPower={false} />
        )}
        {!use3D && (
          <div className="lite-screen-wrap">
            <div className="lite-screen" ref={screenHostRef} />
          </div>
        )}
      </div>

      <TopBar />

      {/* duo status chip */}
      {duo.active && (
        <div className="duo-chip" title="booth for two">
          <span className={`dot ${duo.connected ? 'on' : ''}`} />
          {duo.connected ? `with ${duo.partnerName ?? 'your friend'} 💞` : 'friend disconnected'}
          <span className="duo-side">{duo.role === 'host' ? 'you’re on the left' : 'you’re on the right'}</span>
        </div>
      )}

      {/* camera states */}
      {(status === 'denied' || status === 'error') && (
        <div className="err-holder"><CameraError status={status} message={error} onRetry={() => start()} /></div>
      )}
      {status === 'requesting' && <div className="cam-loading">waking the camera… ✨</div>}

      {/* overlays */}
      {countNum !== null && (
        <div className="count-overlay"><div ref={numRef} className="count-num">{countNum}</div></div>
      )}
      {mode === 'smile' && sub === 'running' && (
        <div className="smile-meter">
          <span>smile! 😊</span>
          <div className="smile-bar"><div style={{ width: `${Math.min(100, (smile / 0.4) * 100)}%` }} /></div>
        </div>
      )}
      {note && <div className="note-pill">{note}</div>}
      <div className={`flash ${flash ? 'on' : ''}`} aria-hidden />

      {/* film-strip rail */}
      {thumbs.length > 0 && (
        <div className="film-rail" aria-label="captured shots">
          {thumbs.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={t} alt={`shot ${i + 1}`} className="film-cell" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      )}

      {/* control deck */}
      <div className="deck grain">
        <FilterRail />
        <div className="deck-row">
          <ModeDial disabled={busy} duo={duo.connected} />
          <div className="shutter-wrap">
            <button className="arcade-btn" onClick={startCapture} disabled={busy || status !== 'ready'} aria-label="take photos (space)">
              <span className="arcade-top">{busy ? '···' : 'SNAP'}</span>
            </button>
            <span className="label-spaced">{duo.connected ? 'snaps you both!' : 'press to snap'}</span>
          </div>
          <div className="side-controls">
            <div className="count-picker">
              <span className="label-spaced">timer</span>
              <div className="count-btns">
                {[3, 5, 10].map((s) => (
                  <button key={s} className={`chip ${countdownSeconds === s ? 'active' : ''}`} onClick={() => setCountdown(s as 3 | 5 | 10)} disabled={busy}>{s}s</button>
                ))}
              </div>
            </div>
            <div className="row-mini">
              {cameras.length > 1 && <button className="btn btn-ghost mini" onClick={flip} disabled={busy}>⇄ flip</button>}
              {sub === 'running' && shots.length > 0 && !duo.connected && mode !== 'boomerang' && (
                <button className="btn btn-ghost mini" onClick={retakeLast}>↺ redo</button>
              )}
            </div>
          </div>
        </div>
        <span className="drag-hint">{use3D ? 'drag to look around · scroll to lean in' : ''}</span>
      </div>

      {sub === 'burst-select' && (
        <BurstSelect
          onDone={(indices) => {
            if (duo.connected) getActiveRoom()?.send({ t: 'burst-pick', indices });
            setSub('printing');
          }}
          onCancel={() => setSub('idle')}
        />
      )}
      {sub === 'burst-wait' && (
        <div className="wait-overlay">
          <div className="wait-card card grain">
            <div className="spin">💞</div>
            <p>{duo.partnerName ?? 'your friend'} is picking the best 4…</p>
          </div>
        </div>
      )}
      {(sub === 'gif-encoding' || sub === 'gif-result') && (
        <GifResult encoding={sub === 'gif-encoding'} progress={gifProgress} onClose={() => { setBoomerang(null); setSub('idle'); }} />
      )}
      {sub === 'printing' && <PrintTransition onDone={() => setPhase('edit')} />}

      <StyleBlock />
    </div>
  );
}

function StyleBlock() {
  return (
    <style jsx global>{`
      .booth-interior { position: absolute; inset: 0; overflow: hidden; background: #ffe3ea; }
      .stage3d { position: absolute; inset: 0; }
      .lite-screen-wrap { position: absolute; inset: 0; display: grid; place-items: center; padding: 70px 14px 230px; background: radial-gradient(120% 80% at 50% -10%, var(--blush), transparent 60%), linear-gradient(180deg, #ffeef3 0%, var(--cream) 50%, #f7e6d8 100%); }
      .lite-screen { position: relative; width: min(100%, 720px); aspect-ratio: 16/9; border: 6px solid var(--brown); border-radius: 26px; overflow: hidden; background: #111; box-shadow: var(--shadow-md), inset 0 0 0 4px #fff; }

      .err-holder { position: absolute; inset: 0; z-index: 30; }
      .cam-loading { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); z-index: 30; color: var(--brown); font-family: var(--font-hand); font-size: 1.3rem; background: rgba(255,255,255,0.85); border-radius: 999px; padding: 10px 22px; border: 2px dashed var(--pink); }

      .duo-chip { position: absolute; top: 58px; left: 50%; transform: translateX(-50%); z-index: 22; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.9); border: 2.5px solid var(--brown); border-radius: 999px; padding: 6px 14px; font-weight: 800; font-size: 0.85rem; color: var(--brown); box-shadow: var(--shadow-sm); }
      .duo-chip .dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; }
      .duo-chip .dot.on { background: #6fcf7c; box-shadow: 0 0 6px #6fcf7c; }
      .duo-side { font-weight: 600; font-size: 0.72rem; color: var(--brown-soft); border-left: 2px dashed var(--blush); padding-left: 8px; }

      .flash { position: absolute; inset: 0; z-index: 26; background: #fff; opacity: 0; pointer-events: none; }
      .flash.on { opacity: 0.95; transition: none; }
      .flash:not(.on) { transition: opacity 0.35s ease; }

      .count-overlay { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; pointer-events: none; }
      .count-num { font-family: var(--font-display); font-weight: 800; font-size: min(36vh, 40vw); color: #fff; text-shadow: 0 0 28px var(--pink), 5px 7px 0 var(--pink-deep); -webkit-text-stroke: 4px var(--brown); }

      .smile-meter { position: absolute; z-index: 25; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.92); border: 2px solid var(--brown); border-radius: 999px; padding: 7px 16px; display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 0.9rem; }
      .smile-bar { width: 130px; height: 12px; background: var(--blush); border-radius: 999px; overflow: hidden; }
      .smile-bar > div { height: 100%; background: var(--pink); transition: width 0.1s linear; }
      .note-pill { position: absolute; z-index: 25; top: 100px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.94); border: 2px dashed var(--pink); border-radius: 16px; padding: 8px 16px; font-size: 0.85rem; font-weight: 700; color: var(--brown); max-width: 86%; text-align: center; }

      .film-rail { position: absolute; z-index: 22; left: 12px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; }
      @media (max-width: 720px) { .film-rail { flex-direction: row; top: auto; bottom: 232px; left: 50%; transform: translateX(-50%); } }
      .film-cell { width: 76px; height: 54px; object-fit: cover; border-radius: 8px; border: 3px solid #fff; box-shadow: var(--shadow-sm); animation: slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
      @keyframes slide-in { from { transform: translateX(-40px) rotate(-8deg); opacity: 0; } to { transform: none; opacity: 1; } }

      .deck { position: absolute; z-index: 24; left: 50%; bottom: 12px; transform: translateX(-50%); width: min(780px, calc(100% - 20px)); display: flex; flex-direction: column; gap: 8px; background: rgba(255,248,240,0.92); border: 3px solid var(--brown); border-radius: 26px; padding: 12px 16px 8px; box-shadow: var(--shadow-md); backdrop-filter: blur(8px); }
      .deck-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      @media (max-width: 720px) { .deck-row { justify-content: center; } .deck { bottom: 6px; padding: 8px 10px 6px; } }
      .drag-hint { text-align: center; font-size: 0.68rem; color: var(--brown-soft); font-weight: 700; letter-spacing: 0.14em; }

      .shutter-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .arcade-btn { width: 86px; height: 86px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, #ff7a97, #e23e63 75%); border: 5px solid #fff; box-shadow: 0 7px 0 #b32a49, var(--shadow-md); color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 1.05rem; transition: transform 0.08s ease, box-shadow 0.08s ease; }
      .arcade-btn:active:not(:disabled) { transform: translateY(6px); box-shadow: 0 1px 0 #b32a49, var(--shadow-sm); }
      .arcade-btn:disabled { filter: saturate(0.6) brightness(0.95); }
      .arcade-top { text-shadow: 1px 2px 0 rgba(0,0,0,0.25); letter-spacing: 0.05em; }

      .side-controls { display: flex; flex-direction: column; gap: 5px; align-items: center; }
      .count-picker { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .count-btns { display: flex; gap: 5px; }
      .row-mini { display: flex; gap: 6px; }
      .mini { font-size: 0.78rem; padding: 0.35em 0.8em; }

      .wait-overlay { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(107,79,79,0.35); backdrop-filter: blur(3px); }
      .wait-card { position: relative; padding: 26px 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; font-weight: 700; color: var(--brown); }
      .wait-card .spin { font-size: 2.6rem; animation: float-y 2s ease-in-out infinite; }
    `}</style>
  );
}
