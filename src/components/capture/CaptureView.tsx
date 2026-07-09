'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useBoothStore, type Shot, type CaptureMode } from '@/store/useBoothStore';
import { accentById } from '@/config/app';
import { useCamera } from '@/lib/capture/useCamera';
import { usePreviewPipeline } from '@/lib/capture/usePreviewPipeline';
import { grabRawFrame, renderFilteredToDataURL } from '@/lib/capture/frameGrab';
import { getActiveRoom, combineFrames, downscaleForWire, type DuoMessage } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import { prefersReducedMotion } from '@/lib/device';
import { POSE_IDEAS } from './poseIdeas';
import { FilterRail } from './FilterRail';
import { ModeDial } from './ModeDial';
import { CameraError } from './CameraError';
import { BurstSelect } from './BurstSelect';
import { GifResult } from './GifResult';
import { PrintTransition } from './PrintTransition';
import { TopBar } from '@/components/ui/TopBar';

const InteriorScene = dynamic(() => import('@/components/booth3d/InteriorScene'), { ssr: false });

type Sub = 'idle' | 'running' | 'confirm' | 'burst-select' | 'burst-wait' | 'gif-encoding' | 'gif-result' | 'printing';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** gap after each shot for the whir + film-slide beat */
const SHOT_GAP_MS = 1500;
const REACTIONS = ['❤️', '😂', '😮', '🥺', '🔥', '👏'];

export function CaptureView() {
  const { videoRef, status, error, cameras, start, flip } = useCamera();
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenHostRef = useRef<HTMLDivElement | null>(null);

  const store = useBoothStore;
  const mode = useBoothStore((s) => s.captureMode);
  const liteMode = useBoothStore((s) => s.liteMode);
  const countdownSeconds = useBoothStore((s) => s.countdownSeconds);
  const shots = useBoothStore((s) => s.shots);
  const duo = useBoothStore((s) => s.duo);
  const accent = useBoothStore((s) => s.accent);
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
  const [poseIdx, setPoseIdx] = useState<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [retakeAsk, setRetakeAsk] = useState(false); // partner offered a redo
  const [retakeWait, setRetakeWait] = useState(false); // we offered, waiting
  const numRef = useRef<HTMLDivElement | null>(null);
  const reduced = useRef(false);
  const subRef = useRef<Sub>('idle');
  subRef.current = sub;
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatSeq = useRef(0);

  const { canvasRef: previewCanvasRef } = usePreviewPipeline(videoRef, remoteVideoRef, status === 'ready' || duo.connected);

  // partner frames arriving over the wire, keyed by shot index
  const remoteFrames = useRef<Map<number, string>>(new Map());
  const remoteWaiters = useRef<Map<number, (s: string) => void>>(new Map());
  // partner boomerang frames
  const remoteGif = useRef<Map<number, string>>(new Map());
  const remoteGifTotal = useRef(0);

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

  /**
   * Schedule-driven countdown: counts down so it ENDS at `fireLocal`
   * (a local-clock timestamp). In duo mode both peers compute fireLocal from
   * the same host-clock `fire_at`, so the shutter beat lands together.
   */
  const scheduledCountdown = useCallback(async (fireLocal: number) => {
    for (;;) {
      const msLeft = fireLocal - Date.now();
      if (msLeft <= 60) break;
      const n = Math.ceil(msLeft / 1000);
      setCountNum(n);
      play('countdown');
      if (n <= 3 && !reduced.current && numRef.current) {
        gsap.fromTo(numRef.current,
          { scale: 0.3, y: -24, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.34, ease: 'elastic.out(1, 0.5)' });
      }
      // sleep to this second's boundary, then re-check
      await wait(Math.max(40, fireLocal - (n - 1) * 1000 - Date.now()));
    }
    setCountNum(null);
  }, []);

  const pushThumb = useCallback((raw: string, replace = false) => {
    renderFilteredToDataURL(raw, { filterId: store.getState().filterId })
      .then((t) => setThumbs((p) => (replace ? [...p.slice(0, -1), t] : [...p, t])))
      .catch(() => setThumbs((p) => (replace ? [...p.slice(0, -1), raw] : [...p, raw])));
  }, []);

  const snapLocal = useCallback((): { dataURL: string; width: number; height: number } => {
    doFlash();
    play('shutter');
    return grabRawFrame(videoRef.current!, store.getState().mirror);
  }, [doFlash]);

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
    setNote('waiting for your person’s shot…');
    const partner = await waitRemoteFrame(index);
    setNote(null);
    const combined = await combineFrames(isHost ? wire : partner, isHost ? partner : wire);
    return { id: crypto.randomUUID(), sourceDataURL: combined.dataURL, width: combined.width, height: combined.height };
  }, [waitRemoteFrame]);

  // ── capture sequences (all schedule-driven; see lib/room/clock.ts) ──
  const runTimed = useCallback(async (n: number, isDuo: boolean, fireLocal: number, retake: boolean) => {
    setSub('running');
    const cdMs = store.getState().countdownSeconds * 1000;
    for (let i = 0; i < n; i++) {
      await scheduledCountdown(fireLocal + i * (cdMs + SHOT_GAP_MS));
      const raw = snapLocal();
      if (isDuo) {
        const shot = await makeCombined(i, raw.dataURL);
        if (retake) { replaceLastShot(shot); pushThumb(shot.sourceDataURL, true); }
        else { addShot(shot); pushThumb(shot.sourceDataURL); }
      } else {
        const shot = { id: crypto.randomUUID(), sourceDataURL: raw.dataURL, width: raw.width, height: raw.height };
        if (retake) { replaceLastShot(shot); pushThumb(raw.dataURL, true); }
        else { addShot(shot); pushThumb(raw.dataURL); }
      }
      play('whir');
      await wait(550);
    }
    // duo strips get a mutual "redo last?" confirm beat before printing
    if (isDuo) setSub('confirm');
    else setSub('printing');
  }, [scheduledCountdown, snapLocal, makeCombined, addShot, replaceLastShot, pushThumb]);

  const runBurst = useCallback(async (isDuo: boolean, fireLocal: number) => {
    setSub('running');
    await scheduledCountdown(fireLocal);
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
  }, [scheduledCountdown, snapLocal, waitRemoteFrame, setBurstPool]);

  const encodeGif = useCallback((frames: { data: Uint8ClampedArray; width: number; height: number }[]) => {
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
  }, [setBoomerang]);

  /**
   * Boomerang. Solo: record the filtered preview canvas.
   * Duet: both sides record their OWN half of the preview for the same 1.5s
   * window (same fire_at), exchange the frames as small JPEGs, and each end
   * composes the identical side-by-side loop — host left, guest right.
   */
  const runBoomerang = useCallback(async (isDuo: boolean, fireLocal: number) => {
    setSub('running');
    await scheduledCountdown(fireLocal);
    const src = previewCanvasRef.current!;
    play('whir');

    if (!isDuo) {
      const frames: { data: Uint8ClampedArray; width: number; height: number }[] = [];
      const rw = 320;
      const rh = Math.round((src.height / src.width) * rw);
      const rec = document.createElement('canvas');
      rec.width = rw; rec.height = rh;
      const rctx = rec.getContext('2d')!;
      for (let i = 0; i < 22; i++) {
        rctx.drawImage(src, 0, 0, rw, rh);
        frames.push({ data: rctx.getImageData(0, 0, rw, rh).data, width: rw, height: rh });
        await wait(70);
      }
      doFlash();
      play('shutter');
      encodeGif(frames);
      return;
    }

    // ── duet ──
    const isHost = store.getState().duo.role === 'host';
    const HALF_W = 288, HALF_H = 216;
    const TOTAL = 22;
    const rec = document.createElement('canvas');
    rec.width = HALF_W; rec.height = HALF_H;
    const rctx = rec.getContext('2d')!;
    const myHalfX = isHost ? 0 : src.width / 2;
    const room = getActiveRoom();
    const mine: string[] = [];
    for (let i = 0; i < TOTAL; i++) {
      // my (filtered) half of the split preview
      rctx.drawImage(src, myHalfX, 0, src.width / 2, src.height, 0, 0, HALF_W, HALF_H);
      const jpeg = rec.toDataURL('image/jpeg', 0.75);
      mine.push(jpeg);
      room?.send({ t: 'gif-frame', index: i, jpeg, total: TOTAL });
      await wait(70);
    }
    doFlash();
    play('shutter');
    setNote('trading boomerang frames…');
    // wait for the partner's frames (or as many as arrive in time)
    const deadline = Date.now() + 15000;
    while (remoteGif.current.size < TOTAL && Date.now() < deadline) await wait(120);
    setNote(null);

    const n = Math.min(mine.length, remoteGif.current.size || 0);
    if (n < 4) { setNote('their frames didn’t arrive 🥺 try again?'); setTimeout(() => setNote(null), 2500); setSub('idle'); return; }
    const comp = document.createElement('canvas');
    comp.width = HALF_W * 2; comp.height = HALF_H;
    const cctx = comp.getContext('2d')!;
    const load = (s: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = s; });
    const frames: { data: Uint8ClampedArray; width: number; height: number }[] = [];
    for (let i = 0; i < n; i++) {
      const [a, b] = await Promise.all([load(mine[i]), load(remoteGif.current.get(i)!)]);
      cctx.drawImage(isHost ? a : b, 0, 0, HALF_W, HALF_H);
      cctx.drawImage(isHost ? b : a, HALF_W, 0, HALF_W, HALF_H);
      cctx.fillStyle = 'rgba(255,255,255,0.75)';
      cctx.fillRect(HALF_W - 1, 0, 2, HALF_H);
      frames.push({ data: cctx.getImageData(0, 0, comp.width, comp.height).data, width: comp.width, height: comp.height });
    }
    encodeGif(frames);
  }, [scheduledCountdown, doFlash, encodeGif, previewCanvasRef]);

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
      await runTimed(4, false, Date.now() + store.getState().countdownSeconds * 1000, false);
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
    setSub('printing');
  }, [runTimed, snapLocal, addShot, pushThumb]);

  const beginSequence = useCallback((m: CaptureMode, isDuo: boolean, fireLocal: number, retake = false) => {
    if (!retake) { clearShots(); setThumbs([]); }
    remoteFrames.current.clear();
    remoteGif.current.clear();
    setNote(null);
    setRetakeAsk(false);
    setRetakeWait(false);
    if (m === 'boomerang') runBoomerang(isDuo, fireLocal);
    else if (m === 'burst') runBurst(isDuo, fireLocal);
    else if (m === 'smile') runSmile();
    else runTimed(retake ? 1 : m === 'single' ? 1 : 4, isDuo, fireLocal, retake);
  }, [clearShots, runBoomerang, runBurst, runSmile, runTimed]);

  /** Host: pick fire_at on the shared clock, broadcast, and start locally. */
  const hostStart = useCallback((m: CaptureMode, cd: number, retake = false) => {
    const room = getActiveRoom();
    if (!room) return;
    const lead = (m === 'boomerang' ? Math.min(cd, 3) : cd) * 1000;
    // 500ms pad swallows wire latency so the guest never starts "in the past"
    const fireAt = room.clock.hostNow() + lead + 500;
    room.send({ t: 'capture-start', mode: m, countdown: cd, fireAt, retake });
    beginSequence(m, true, room.clock.toLocal(fireAt), retake);
  }, [beginSequence]);

  const startCapture = useCallback(() => {
    if (subRef.current !== 'idle' || status !== 'ready') return;
    play('pop');
    const st = store.getState();
    if (st.duo.connected) {
      if (st.duo.role === 'host') {
        hostStart(st.captureMode, st.countdownSeconds);
      } else {
        // guest asks the authoritative clock to fire
        getActiveRoom()?.send({ t: 'capture-request', mode: st.captureMode, countdown: st.countdownSeconds });
        setNote('syncing your booths…');
        setTimeout(() => setNote((n) => (n === 'syncing your booths…' ? null : n)), 5000);
      }
    } else {
      const cd = st.captureMode === 'boomerang' ? Math.min(st.countdownSeconds, 3) : st.countdownSeconds;
      beginSequence(st.captureMode, false, Date.now() + cd * 1000);
    }
  }, [status, hostStart, beginSequence]);

  // reactions + pose prompts (duo delight)
  const spawnFloat = useCallback((emoji: string) => {
    const id = ++floatSeq.current;
    setFloats((f) => [...f, { id, emoji, left: 12 + Math.random() * 76 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2600);
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    spawnFloat(emoji);
    play('pop');
    getActiveRoom()?.send({ t: 'reaction', emoji });
  }, [spawnFloat]);

  const showPose = useCallback((index: number) => {
    setPoseIdx(index);
    play('pop');
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseTimer.current = setTimeout(() => setPoseIdx(null), 5200);
  }, []);

  const drawPose = useCallback(() => {
    const index = Math.floor(Math.random() * POSE_IDEAS.length);
    getActiveRoom()?.send({ t: 'pose', index });
    showPose(index);
  }, [showPose]);

  // ── duo message handling ──
  useEffect(() => {
    const room = getActiveRoom();
    if (!room || !duo.connected) return;
    const off = room.on((msg: DuoMessage) => {
      switch (msg.t) {
        case 'frame': {
          remoteFrames.current.set(msg.index, msg.jpeg);
          const w = remoteWaiters.current.get(msg.index);
          if (w) { remoteWaiters.current.delete(msg.index); w(msg.jpeg); }
          break;
        }
        case 'gif-frame':
          remoteGifTotal.current = msg.total;
          remoteGif.current.set(msg.index, msg.jpeg);
          break;
        case 'capture-start': {
          if (subRef.current !== 'idle' && subRef.current !== 'confirm') break;
          const st = useBoothStore.getState();
          st.setMode(msg.mode);
          st.setCountdown(msg.countdown as 3 | 5 | 10);
          beginSequence(msg.mode, true, room.clock.toLocal(msg.fireAt), msg.retake);
          break;
        }
        case 'capture-request':
          // only the host owns the clock — guests never receive this
          if (useBoothStore.getState().duo.role === 'host' && subRef.current === 'idle') {
            useBoothStore.getState().setMode(msg.mode);
            useBoothStore.getState().setCountdown(msg.countdown as 3 | 5 | 10);
            hostStart(msg.mode, msg.countdown);
          }
          break;
        case 'filter':
          filterSyncGuard.current = true;
          useBoothStore.getState().setFilter(msg.id);
          filterSyncGuard.current = false;
          break;
        case 'burst-pick': {
          const pool = useBoothStore.getState().burstPool;
          setShots(msg.indices.map((i) => pool[i]).filter(Boolean));
          setSub('printing');
          break;
        }
        case 'retake-offer':
          if (subRef.current === 'confirm') setRetakeAsk(true);
          break;
        case 'retake-agree':
          // both agreed — host reschedules a single-shot redo
          if (useBoothStore.getState().duo.role === 'host') {
            hostStart(useBoothStore.getState().captureMode === 'single' ? 'single' : 'classic', useBoothStore.getState().countdownSeconds, true);
          }
          break;
        case 'retake-decline':
          setRetakeWait(false);
          setNote('they want to keep it ♡');
          setTimeout(() => setNote(null), 2200);
          break;
        case 'reaction':
          spawnFloat(msg.emoji);
          break;
        case 'pose':
          showPose(msg.index);
          break;
        case 'go-edit':
          if (subRef.current === 'confirm') setSub('printing');
          break;
      }
    });
    return off;
  }, [duo.connected, beginSequence, hostStart, setShots, spawnFloat, showPose]);

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

  // mutual retake: offer / answer
  const offerRetake = useCallback(() => {
    setRetakeWait(true);
    play('pop');
    getActiveRoom()?.send({ t: 'retake-offer' });
  }, []);

  const answerRetake = useCallback((yes: boolean) => {
    setRetakeAsk(false);
    const st = useBoothStore.getState();
    if (!yes) { getActiveRoom()?.send({ t: 'retake-decline' }); return; }
    if (st.duo.role === 'host') {
      hostStart(st.captureMode === 'single' ? 'single' : 'classic', st.countdownSeconds, true);
    } else {
      getActiveRoom()?.send({ t: 'retake-agree' });
    }
  }, [hostStart]);

  const confirmPrint = useCallback(() => {
    play('pop');
    getActiveRoom()?.send({ t: 'go-edit' });
    setSub('printing');
  }, []);

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
  const myAccent = accentById(accent).value;
  const theirAccent = duo.partnerAccent ? accentById(duo.partnerAccent).value : 'var(--sky)';

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
        <div className="duo-chip" title="room for two">
          <span className={`dot ${duo.connected ? 'on' : ''}`} />
          {duo.connected ? <>together in <b>{duo.code}</b> 💞</> : 'they disconnected'}
          <span className="duo-side">
            <i style={{ background: duo.role === 'host' ? myAccent : theirAccent }} /> left
            <i style={{ background: duo.role === 'host' ? theirAccent : myAccent, marginLeft: 8 }} /> right
          </span>
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
      {poseIdx !== null && (
        <div className="pose-card card grain">
          <span className="label-spaced">p o s e&nbsp;&nbsp;i d e a</span>
          <strong>{POSE_IDEAS[poseIdx]}</strong>
        </div>
      )}
      <div className={`flash ${flash ? 'on' : ''}`} aria-hidden />

      {/* floating reactions */}
      <div className="floats" aria-hidden>
        {floats.map((f) => (
          <span key={f.id} style={{ left: `${f.left}%` }}>{f.emoji}</span>
        ))}
      </div>

      {/* film-strip rail */}
      {thumbs.length > 0 && (
        <div className="film-rail" aria-label="captured shots">
          {thumbs.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={t} alt={`shot ${i + 1}`} className="film-cell" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      )}

      {/* duo side rail: reactions + pose deck */}
      {duo.connected && (
        <div className="react-rail">
          {REACTIONS.map((r) => (
            <button key={r} onClick={() => sendReaction(r)} aria-label={`react ${r}`}>{r}</button>
          ))}
          <button className="pose-btn" onClick={drawPose} disabled={sub === 'running'} aria-label="draw a pose idea">🎴</button>
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

      {/* duo confirm: mutual retake before printing */}
      {sub === 'confirm' && (
        <div className="confirm-bar card grain">
          {retakeWait ? (
            <span className="cb-note"><span className="pulse-dot" /> asked to redo — waiting for them…</span>
          ) : retakeAsk ? (
            <>
              <span className="cb-note">they’d like to redo the last shot ↺</span>
              <button className="btn btn-primary" onClick={() => answerRetake(true)}>redo it!</button>
              <button className="btn btn-ghost" onClick={() => answerRetake(false)}>keep it</button>
            </>
          ) : (
            <>
              <span className="cb-note">happy with the strip?</span>
              <button className="btn btn-primary" onClick={confirmPrint}>✨ print it</button>
              <button className="btn btn-ghost" onClick={offerRetake}>↺ redo last</button>
            </>
          )}
        </div>
      )}

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
            <p>your person is picking the best 4…</p>
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
      .duo-side { display: flex; align-items: center; gap: 4px; font-weight: 600; font-size: 0.72rem; color: var(--brown-soft); border-left: 2px dashed var(--blush); padding-left: 8px; }
      .duo-side i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--brown); }

      .flash { position: absolute; inset: 0; z-index: 26; background: #fff; opacity: 0; pointer-events: none; }
      .flash.on { opacity: 0.95; transition: none; }
      .flash:not(.on) { transition: opacity 0.35s ease; }

      .count-overlay { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; pointer-events: none; }
      .count-num { font-family: var(--font-display); font-weight: 800; font-size: min(36vh, 40vw); color: #fff; text-shadow: 0 0 28px var(--pink), 5px 7px 0 var(--pink-deep); -webkit-text-stroke: 4px var(--brown); }

      .smile-meter { position: absolute; z-index: 25; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.92); border: 2px solid var(--brown); border-radius: 999px; padding: 7px 16px; display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 0.9rem; }
      .smile-bar { width: 130px; height: 12px; background: var(--blush); border-radius: 999px; overflow: hidden; }
      .smile-bar > div { height: 100%; background: var(--pink); transition: width 0.1s linear; }
      .note-pill { position: absolute; z-index: 25; top: 100px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.94); border: 2px dashed var(--pink); border-radius: 16px; padding: 8px 16px; font-size: 0.85rem; font-weight: 700; color: var(--brown); max-width: 86%; text-align: center; }

      .pose-card { position: absolute; z-index: 27; top: 16%; left: 50%; transform: translateX(-50%) rotate(-2deg); padding: 14px 22px; display: flex; flex-direction: column; align-items: center; gap: 4px; animation: pop-in 0.3s ease; }
      .pose-card strong { font-family: var(--font-display); font-size: 1.3rem; color: var(--pink-deep); }

      .floats { position: absolute; inset: 0; z-index: 27; pointer-events: none; overflow: hidden; }
      .floats span { position: absolute; bottom: 210px; font-size: 2rem; animation: float-react 2.6s ease-out forwards; }
      @keyframes float-react {
        0% { transform: translateY(0) scale(0.6); opacity: 0; }
        12% { opacity: 1; transform: translateY(-30px) scale(1.15); }
        100% { transform: translateY(-46vh) scale(0.9) rotate(14deg); opacity: 0; }
      }

      .react-rail { position: absolute; z-index: 23; right: 12px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.85); border: 2.5px solid var(--brown); border-radius: 999px; padding: 10px 6px; box-shadow: var(--shadow-sm); }
      .react-rail button { background: none; border: none; font-size: 1.3rem; padding: 3px; border-radius: 50%; transition: transform 0.12s ease; }
      .react-rail button:hover { transform: scale(1.3); }
      .react-rail .pose-btn { border-top: 2px dashed var(--blush); border-radius: 0; padding-top: 8px; }
      .react-rail .pose-btn:disabled { opacity: 0.4; }
      @media (max-width: 720px) { .react-rail { flex-direction: row; top: auto; bottom: 236px; right: 50%; transform: translateX(50%); padding: 4px 12px; } .react-rail .pose-btn { border-top: none; border-left: 2px dashed var(--blush); padding-top: 3px; padding-left: 10px; } }

      .confirm-bar { position: absolute; z-index: 40; left: 50%; bottom: 210px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 12px 18px; animation: pop-in 0.3s ease; max-width: min(94vw, 560px); flex-wrap: wrap; justify-content: center; }
      .confirm-bar .cb-note { font-weight: 800; color: var(--brown); font-size: 0.92rem; display: flex; align-items: center; gap: 8px; }
      .confirm-bar .pulse-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
      .confirm-bar :global(.btn) { font-size: 0.9rem; padding: 0.5em 1.1em; }

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
