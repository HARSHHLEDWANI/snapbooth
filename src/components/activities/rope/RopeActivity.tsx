'use client';

/**
 * RopeActivity — "tied together": a co-op physics platformer for two blobs
 * joined by an elastic ribbon. Built last, like the prompt said. 🎀
 *
 * ── PHYSICS-SYNC PROTOCOL (host-authoritative) ──────────────────────────
 * The HOST runs the only Matter.js engine. The guest streams its input
 * (~30/s, plus instantly on change): { left, right, jump, anchor }. The host
 * applies both people's inputs, steps the world at 60fps, and broadcasts a
 * compact snapshot ~20/s: blob positions, rope points, plate/door/lift
 * state, fail count and stage. The guest buffers the last two snapshots and
 * renders ~120ms in the past, interpolating between them — plus a small
 * cosmetic lean on its own blob in the direction it's pressing, so input
 * feels acknowledged even before the next snapshot lands (a light stand-in
 * for full client-side prediction; fair-weather for a casual co-op).
 *
 * Latency tolerance is a DESIGN rule, not a netcode trick: puzzles are
 * cooperation-shaped (hold a plate, be a counterweight, anchor a swing) and
 * never precision-timing jumps. Fails are cute: boing back to spawn, +1 on
 * the giggle counter, infinite retries. Completion stamps live in component
 * state only — close the tab and the park forgets you were ever there.
 *
 * Each blob wears a webcam selfie snapped once at start (one frame, straight
 * to a tiny canvas, camera released immediately; exchanged peer-to-peer like
 * every other frame in the app — never stored anywhere).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Engine, Body as MatterBody, World } from 'matter-js';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { play } from '@/lib/sound/sound';
import type { ActivityProps } from '../ActivityHost';
import { ROPE_LEVELS, WORLD_W, WORLD_H, type RopeLevel } from './levels';

const BLOB_R = 24;
const ROPE_SEGS = 9;
const SEG_LEN = 30;
const MOVE_SPEED = 4.6;
const JUMP_VY = -11.5;
const SNAP_HZ = 20;
const INPUT_HZ = 30;
const INTERP_DELAY_MS = 120;

interface Input { l: boolean; r: boolean; j: boolean; a: boolean }
const emptyInput = (): Input => ({ l: false, r: false, j: false, a: false });

interface Snapshot {
  t: number;             // host time — only used for ordering
  a: [number, number];   // blob A (host)
  b: [number, number];
  rope: [number, number][];
  plates: boolean[];
  doors: boolean[];
  liftY: number | null;
  fails: number;
  won: boolean;
}

type Msg =
  | { k: 'level'; i: number }
  | { k: 'in'; l: boolean; r: boolean; j: boolean; a: boolean }
  | { k: 'sn'; s: Snapshot }
  | { k: 'face'; who: 'host' | 'guest'; jpeg: string }
  | { k: 'reset' }
  | { k: 'menu' };

export function RopeActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const [levelIdx, setLevelIdx] = useState<number | null>(null);
  const [stamps, setStamps] = useState<boolean[]>(() => ROPE_LEVELS.map(() => false));
  const [fails, setFails] = useState(0);
  const [won, setWon] = useState(false);
  const [ready, setReady] = useState(false); // physics/canvas alive

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  // input state (mine, sent to host if I'm the guest)
  const myInput = useRef<Input>(emptyInput());
  const guestInput = useRef<Input>(emptyInput()); // host-side: latest from guest

  // host-side physics
  const engineRef = useRef<Engine | null>(null);
  const worldRef = useRef<World | null>(null);
  const blobsRef = useRef<{ a: MatterBody; b: MatterBody } | null>(null);
  const ropeRef = useRef<MatterBody[]>([]);
  const doorsRef = useRef<MatterBody[]>([]);
  const liftSeatRef = useRef<MatterBody | null>(null);
  const liftRiseRef = useRef(0);
  const failsRef = useRef(0);
  const wonRef = useRef(false);
  const levelRef = useRef<RopeLevel | null>(null);

  // guest-side snapshot buffer
  const snaps = useRef<{ at: number; s: Snapshot }[]>([]);
  // both sides: latest authoritative view for rendering (host fills from engine)
  const view = useRef<Snapshot | null>(null);

  // selfie faces
  const faces = useRef<{ host: HTMLImageElement | null; guest: HTMLImageElement | null }>({ host: null, guest: null });

  const send = useActivityChannel<Msg>('rope', (m) => {
    switch (m.k) {
      case 'level':
        startLevel(m.i, false);
        break;
      case 'in':
        guestInput.current = { l: m.l, r: m.r, j: guestInput.current.j || m.j, a: m.a };
        break;
      case 'sn':
        snaps.current.push({ at: performance.now(), s: m.s });
        if (snaps.current.length > 6) snaps.current.shift();
        if (m.s.won && !wonRef.current) { wonRef.current = true; setWon(true); markStamp(); play('success'); }
        if (!m.s.won) wonRef.current = false;
        setFails(m.s.fails);
        break;
      case 'face': {
        const img = new Image();
        img.onload = () => { faces.current[m.who] = img; };
        img.src = m.jpeg;
        break;
      }
      case 'reset':
        if (isHost) respawn();
        break;
      case 'menu':
        setLevelIdx(null);
        setWon(false);
        break;
    }
  });

  const markStamp = () => {
    setStamps((st) => {
      const idx = levelIdxRef.current;
      if (idx === null) return st;
      const next = [...st];
      next[idx] = true;
      return next;
    });
  };

  const levelIdxRef = useRef(levelIdx);
  levelIdxRef.current = levelIdx;

  // ── selfie face: one frame, then the camera is released ──
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320 }, audio: false });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise((r) => setTimeout(r, 350)); // let exposure settle
        const c = document.createElement('canvas');
        c.width = 96; c.height = 96;
        const s = Math.min(video.videoWidth, video.videoHeight);
        c.getContext('2d')!.drawImage(
          video,
          (video.videoWidth - s) / 2, (video.videoHeight - s) / 2, s, s,
          0, 0, 96, 96,
        );
        stream.getTracks().forEach((t) => t.stop());
        if (dead) return;
        const jpeg = c.toDataURL('image/jpeg', 0.8);
        const img = new Image();
        img.onload = () => { faces.current[role] = img; };
        img.src = jpeg;
        send({ k: 'face', who: role, jpeg });
      } catch { /* faceless blobs are also cute */ }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── host: build & run the world ──
  const startLevel = (i: number, broadcast: boolean) => {
    if (broadcast) send({ k: 'level', i });
    setLevelIdx(i);
    setWon(false);
    wonRef.current = false;
    failsRef.current = 0;
    setFails(0);
    snaps.current = [];
    view.current = null;
    play('pop');
  };

  useEffect(() => {
    if (levelIdx === null || !isHost) return;
    let alive = true;
    let engineTimer: ReturnType<typeof setInterval> | null = null;
    let snapTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const M = (await import('matter-js')).default;
      if (!alive) return;
      const level = ROPE_LEVELS[levelIdx];
      levelRef.current = level;

      const engine = M.Engine.create({ gravity: { x: 0, y: 1.15 } });
      engineRef.current = engine;
      worldRef.current = engine.world;

      const statics: MatterBody[] = [];
      // walls so nobody leaves the world sideways
      statics.push(M.Bodies.rectangle(-20, WORLD_H / 2, 40, WORLD_H * 2, { isStatic: true }));
      statics.push(M.Bodies.rectangle(WORLD_W + 20, WORLD_H / 2, 40, WORLD_H * 2, { isStatic: true }));
      for (const p of level.platforms)
        statics.push(M.Bodies.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, { isStatic: true, label: 'plat' }));

      doorsRef.current = level.doors.map((d) =>
        M.Bodies.rectangle(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h, { isStatic: true, label: 'door' }));

      liftSeatRef.current = level.lift
        ? M.Bodies.rectangle(
            level.lift.platform.x + level.lift.platform.w / 2,
            level.lift.platform.y + level.lift.platform.h / 2,
            level.lift.platform.w, level.lift.platform.h,
            { isStatic: true, label: 'lift' })
        : null;
      liftRiseRef.current = 0;

      const blobOpts = { friction: 0.6, frictionAir: 0.02, restitution: 0.05, density: 0.0022, label: 'blob' };
      const a = M.Bodies.circle(level.spawnA.x, level.spawnA.y, BLOB_R, blobOpts);
      const b = M.Bodies.circle(level.spawnB.x, level.spawnB.y, BLOB_R, blobOpts);
      blobsRef.current = { a, b };

      // the ribbon: a chain of light links; collides with the world but not the blobs
      const links: MatterBody[] = [];
      for (let s = 0; s < ROPE_SEGS; s++) {
        const t = (s + 1) / (ROPE_SEGS + 1);
        links.push(M.Bodies.circle(
          level.spawnA.x + (level.spawnB.x - level.spawnA.x) * t,
          level.spawnA.y - 12,
          4,
          { density: 0.0004, frictionAir: 0.03, collisionFilter: { group: -7 }, label: 'rope' },
        ));
      }
      ropeRef.current = links;
      a.collisionFilter.group = -7;
      b.collisionFilter.group = -7;

      const constraints = [];
      const chain = [a, ...links, b];
      for (let s = 0; s < chain.length - 1; s++) {
        constraints.push(M.Constraint.create({
          bodyA: chain[s], bodyB: chain[s + 1],
          length: SEG_LEN, stiffness: 0.32, damping: 0.06,
        }));
      }

      M.Composite.add(engine.world, [...statics, ...doorsRef.current, ...(liftSeatRef.current ? [liftSeatRef.current] : []), a, b, ...links, ...constraints]);

      const inRect = (body: MatterBody, r: { x: number; y: number; w: number; h: number }, pad = 0) =>
        body.position.x > r.x - pad && body.position.x < r.x + r.w + pad &&
        body.position.y > r.y - pad && body.position.y < r.y + r.h + pad;

      const grounded = (blob: MatterBody) => {
        const region = { min: { x: blob.position.x - BLOB_R * 0.7, y: blob.position.y + BLOB_R - 2 }, max: { x: blob.position.x + BLOB_R * 0.7, y: blob.position.y + BLOB_R + 8 } };
        return M.Query.region([...statics, ...doorsRef.current.filter((d) => !d.isSensor), ...(liftSeatRef.current ? [liftSeatRef.current] : [])], region).length > 0;
      };

      const anchoredFlags = { a: false, b: false };

      const applyInput = (blob: MatterBody, input: Input, who: 'a' | 'b') => {
        // anchor: hold on inside an anchor zone → become a fixed point
        const inAnchor = level.anchors.some((z) => inRect(blob, z, 20));
        const wantAnchor = input.a && inAnchor;
        if (wantAnchor && !anchoredFlags[who]) { M.Body.setStatic(blob, true); anchoredFlags[who] = true; }
        else if (!wantAnchor && anchoredFlags[who]) { M.Body.setStatic(blob, false); anchoredFlags[who] = false; }
        if (anchoredFlags[who]) return;

        const vx = input.l ? -MOVE_SPEED : input.r ? MOVE_SPEED : blob.velocity.x * 0.82;
        M.Body.setVelocity(blob, { x: vx, y: blob.velocity.y });
        if (input.j && grounded(blob)) {
          M.Body.setVelocity(blob, { x: blob.velocity.x, y: JUMP_VY });
          play('pop');
        }
        input.j = false; // jumps are edge-triggered, consume
      };

      const respawnNow = () => {
        failsRef.current += 1;
        setFails(failsRef.current);
        anchoredFlags.a = anchoredFlags.b = false;
        M.Body.setStatic(a, false); M.Body.setStatic(b, false);
        M.Body.setPosition(a, level.spawnA); M.Body.setVelocity(a, { x: 0, y: 0 });
        M.Body.setPosition(b, level.spawnB); M.Body.setVelocity(b, { x: 0, y: 0 });
        links.forEach((l2, idx) => {
          const t = (idx + 1) / (ROPE_SEGS + 1);
          M.Body.setPosition(l2, { x: level.spawnA.x + (level.spawnB.x - level.spawnA.x) * t, y: level.spawnA.y - 12 });
          M.Body.setVelocity(l2, { x: 0, y: 0 });
        });
        play('whir');
      };
      respawnRef.current = respawnNow;

      engineTimer = setInterval(() => {
        if (wonRef.current) return;
        applyInput(a, myInput.current, 'a');
        applyInput(b, guestInput.current, 'b');

        // plates: pressed while either blob overlaps
        const platesPressed = level.plates.map((p) => inRect(a, p, BLOB_R) || inRect(b, p, BLOB_R));
        // doors: sensors (open) while their plate is held
        doorsRef.current.forEach((d, di) => { d.isSensor = platesPressed[level.doors[di].plate] ?? false; });

        // counterweight lift: someone on the weight pad raises the seat
        if (level.lift && liftSeatRef.current) {
          const onWeight = inRect(a, level.lift.weight, BLOB_R) || inRect(b, level.lift.weight, BLOB_R);
          const target = onWeight ? level.lift.travel : 0;
          const prev = liftRiseRef.current;
          liftRiseRef.current += Math.max(-2.2, Math.min(2.6, target - prev));
          const dy = liftRiseRef.current - prev;
          if (dy !== 0) {
            M.Body.setPosition(liftSeatRef.current, {
              x: liftSeatRef.current.position.x,
              y: level.lift.platform.y + level.lift.platform.h / 2 - liftRiseRef.current,
            });
            // carry riders along so the seat doesn't slide out from under them
            for (const blob of [a, b]) {
              const onSeat = Math.abs(blob.position.x - liftSeatRef.current.position.x) < level.lift.platform.w / 2 + BLOB_R * 0.5 &&
                Math.abs(blob.position.y + BLOB_R - (liftSeatRef.current.position.y - level.lift.platform.h / 2)) < 14;
              if (onSeat) M.Body.setPosition(blob, { x: blob.position.x, y: blob.position.y - dy });
            }
          }
        }

        // hazards: the soft abyss
        if (level.hazards.some((hz) => inRect(a, hz, 0) || inRect(b, hz, 0)) ||
            a.position.y > WORLD_H + 60 || b.position.y > WORLD_H + 60) {
          respawnNow();
        }

        // goal: both inside → won
        if (level.goal && inRect(a, level.goal, 6) && inRect(b, level.goal, 6)) {
          wonRef.current = true;
          setWon(true);
          markStamp();
          play('success');
        }

        M.Engine.update(engine, 1000 / 60);

        // refresh the local render view straight from the engine
        view.current = {
          t: performance.now(),
          a: [a.position.x, a.position.y],
          b: [b.position.x, b.position.y],
          rope: links.map((l2) => [l2.position.x, l2.position.y] as [number, number]),
          plates: platesPressed,
          doors: doorsRef.current.map((d) => d.isSensor),
          liftY: liftSeatRef.current ? liftSeatRef.current.position.y : null,
          fails: failsRef.current,
          won: wonRef.current,
        };
      }, 1000 / 60);

      snapTimer = setInterval(() => {
        if (view.current) send({ k: 'sn', s: { ...view.current, rope: view.current.rope.map(([x, y]) => [Math.round(x), Math.round(y)]) } });
      }, 1000 / SNAP_HZ);

      setReady(true);
    })();

    return () => {
      alive = false;
      if (engineTimer) clearInterval(engineTimer);
      if (snapTimer) clearInterval(snapTimer);
      engineRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, isHost]);

  const respawnRef = useRef<() => void>(() => {});
  const respawn = () => respawnRef.current();

  // guest is "ready" as soon as a level is chosen — it just renders snapshots
  useEffect(() => {
    if (!isHost && levelIdx !== null) setReady(true);
    if (!isHost && levelIdx === null) setReady(false);
  }, [isHost, levelIdx]);

  // ── guest: stream input ──
  useEffect(() => {
    if (isHost || levelIdx === null) return;
    const iv = setInterval(() => {
      const i = myInput.current;
      send({ k: 'in', l: i.l, r: i.r, j: i.j, a: i.a });
      i.j = false; // edge-triggered
    }, 1000 / INPUT_HZ);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, levelIdx]);

  // ── controls ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) myInput.current.l = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) myInput.current.r = true;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { myInput.current.j = true; e.preventDefault(); }
      if (['ShiftLeft', 'ShiftRight', 'ArrowDown', 'KeyS'].includes(e.code)) myInput.current.a = true;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) myInput.current.l = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) myInput.current.r = false;
      if (['ShiftLeft', 'ShiftRight', 'ArrowDown', 'KeyS'].includes(e.code)) myInput.current.a = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const touch = (key: 'l' | 'r' | 'a', v: boolean) => { myInput.current[key] = v; };
  const touchJump = () => { myInput.current.j = true; };

  // ── render loop (both sides) ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const level = levelIdx !== null ? ROPE_LEVELS[levelIdx] : null;
    if (!canvas || !level) { rafRef.current = requestAnimationFrame(draw); return; }
    const ctx = canvas.getContext('2d')!;
    const scale = canvas.width / WORLD_W;

    // guest: interpolate the two snapshots straddling (now - delay)
    let v = view.current;
    if (!isHost) {
      const buf = snaps.current;
      const target = performance.now() - INTERP_DELAY_MS;
      if (buf.length >= 2) {
        let i0 = 0;
        for (let i = buf.length - 2; i >= 0; i--) if (buf[i].at <= target) { i0 = i; break; }
        const s0 = buf[i0], s1 = buf[Math.min(i0 + 1, buf.length - 1)];
        const span = Math.max(1, s1.at - s0.at);
        const f = Math.max(0, Math.min(1, (target - s0.at) / span));
        const lerp = (p: [number, number], q: [number, number]): [number, number] =>
          [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
        v = {
          ...s1.s,
          a: lerp(s0.s.a, s1.s.a),
          b: lerp(s0.s.b, s1.s.b),
          rope: s1.s.rope.map((pt, i) => (s0.s.rope[i] ? lerp(s0.s.rope[i], pt) : pt)),
        };
      } else if (buf.length === 1) {
        v = buf[0].s;
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, '#ffeef4'); g.addColorStop(1, '#fff8f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // goal
    ctx.fillStyle = 'rgba(126, 208, 168, 0.35)';
    rounded(ctx, level.goal.x, level.goal.y, level.goal.w, level.goal.h, 14);
    ctx.fill();
    ctx.font = '34px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏡', level.goal.x + level.goal.w / 2, level.goal.y + level.goal.h / 2 + 10);

    // anchors
    for (const z of level.anchors) {
      ctx.fillStyle = 'rgba(183, 156, 237, 0.3)';
      rounded(ctx, z.x, z.y, z.w, z.h, 12);
      ctx.fill();
      ctx.font = '22px serif';
      ctx.fillText('⚓', z.x + z.w / 2, z.y + 28);
    }

    // platforms
    for (const p of level.platforms) {
      ctx.fillStyle = '#f5c6d5';
      rounded(ctx, p.x, p.y, p.w, p.h, 10);
      ctx.fill();
      ctx.fillStyle = '#a8dfc0';
      rounded(ctx, p.x, p.y, p.w, Math.min(12, p.h), 6);
      ctx.fill();
    }

    // hazards (soft clouds of doom)
    for (const hz of level.hazards) {
      ctx.fillStyle = 'rgba(255, 143, 171, 0.25)';
      rounded(ctx, hz.x, hz.y, hz.w, hz.h, 12);
      ctx.fill();
    }

    // plates
    level.plates.forEach((p, i) => {
      const pressed = v?.plates?.[i];
      ctx.fillStyle = pressed ? '#7ed0a8' : '#ffe8a3';
      rounded(ctx, p.x, p.y + (pressed ? 8 : 0), p.w, p.h - (pressed ? 8 : 0), 8);
      ctx.fill();
    });

    // doors
    level.doors.forEach((d, i) => {
      const open = v?.doors?.[i];
      ctx.fillStyle = open ? 'rgba(107, 79, 79, 0.15)' : '#6b4f4f';
      rounded(ctx, d.x, d.y, d.w, d.h, 8);
      ctx.fill();
    });

    // lift
    if (level.lift) {
      const seatY = v?.liftY !== null && v?.liftY !== undefined
        ? v.liftY - level.lift.platform.h / 2
        : level.lift.platform.y;
      ctx.fillStyle = '#bde0fe';
      rounded(ctx, level.lift.platform.x, seatY, level.lift.platform.w, level.lift.platform.h, 8);
      ctx.fill();
      ctx.fillStyle = '#f0c060';
      rounded(ctx, level.lift.weight.x, level.lift.weight.y, level.lift.weight.w, level.lift.weight.h, 8);
      ctx.fill();
      ctx.font = '16px serif';
      ctx.fillText('⚖️', level.lift.weight.x + level.lift.weight.w / 2, level.lift.weight.y + 18);
    }

    if (v) {
      // cosmetic lean on my own blob so input feels instant on the guest
      let [ax, ay] = v.a;
      let [bx, by] = v.b;
      if (!isHost) {
        const lean = myInput.current.l ? -5 : myInput.current.r ? 5 : 0;
        bx += lean;
      }

      // ribbon through the rope points
      const pts: [number, number][] = [[ax, ay], ...v.rope, [bx, by]];
      ctx.strokeStyle = '#f0c060';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.stroke();
      // bow at the middle
      const mid = pts[Math.floor(pts.length / 2)];
      ctx.font = '20px serif';
      ctx.fillText('🎀', mid[0], mid[1] + 7);

      drawBlob(ctx, ax, ay, '#ff8fab', faces.current.host);
      drawBlob(ctx, bx, by, '#7fb5f0', faces.current.guest);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [levelIdx, isHost]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── UI ──
  if (levelIdx === null) {
    return (
      <div className="rope-wrap">
        <div className="panel card grain">
          <div className="big-emoji">🎀</div>
          <h3>tied together</h3>
          <p>two blobs, one elastic ribbon, zero dignity. cooperate through three tiny levels — fails just boing you back, and the giggle counter keeps score of the chaos.</p>
          <div className="levels">
            {ROPE_LEVELS.map((l, i) => (
              <button
                key={l.id}
                className="level-btn"
                disabled={!isHost}
                onClick={() => startLevel(i, true)}
              >
                <span>{l.emoji}</span>
                <strong>{l.name}</strong>
                {stamps[i] && <em className="stamp">★ done</em>}
              </button>
            ))}
          </div>
          {!isHost && <div className="waiting"><span className="pulse-dot" /> your person picks the level…</div>}
          <p className="controls-hint">⌨️ arrows/WASD move · space jumps · shift holds on (⚓ zones)</p>
        </div>
        <RopeStyles />
      </div>
    );
  }

  const level = ROPE_LEVELS[levelIdx];

  return (
    <div className="rope-wrap">
      <div className="hud-row">
        <span className="pill">{level.emoji} {level.name}</span>
        <span className="pill giggle">🤭 {fails}</span>
        <button className="btn btn-ghost mini" onClick={() => { if (isHost) respawn(); else send({ k: 'reset' }); play('pop'); }}>↺ boing back</button>
        {isHost && <button className="btn btn-ghost mini" onClick={() => { send({ k: 'menu' }); setLevelIdx(null); setWon(false); }}>≡ levels</button>}
      </div>

      <div className="stage">
        <canvas ref={canvasRef} width={WORLD_W} height={WORLD_H} />
        {!ready && <div className="loading"><span className="pulse-dot" /> tying the ribbon…</div>}
        {won && (
          <div className="won card grain">
            <div className="big-emoji">🎉</div>
            <h3>you made it — together, obviously</h3>
            <p>giggle counter: {fails} {fails === 0 ? '(flawless?! suspicious)' : fails < 5 ? '(respectable chaos)' : '(a comedy masterpiece)'}</p>
            <div className="row">
              {isHost && levelIdx < ROPE_LEVELS.length - 1 && (
                <button className="btn btn-primary" onClick={() => startLevel(levelIdx + 1, true)}>next level →</button>
              )}
              {isHost && <button className="btn btn-ghost" onClick={() => { send({ k: 'menu' }); setLevelIdx(null); setWon(false); }}>level menu</button>}
              <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic</button>
            </div>
          </div>
        )}
        <p className="hint">{level.hint}</p>
      </div>

      {/* touch controls */}
      <div className="pads" aria-hidden>
        <div className="pad-group">
          <button className="pad" onPointerDown={() => touch('l', true)} onPointerUp={() => touch('l', false)} onPointerLeave={() => touch('l', false)}>◀</button>
          <button className="pad" onPointerDown={() => touch('r', true)} onPointerUp={() => touch('r', false)} onPointerLeave={() => touch('r', false)}>▶</button>
        </div>
        <div className="pad-group">
          <button className="pad hold" onPointerDown={() => touch('a', true)} onPointerUp={() => touch('a', false)} onPointerLeave={() => touch('a', false)}>⚓</button>
          <button className="pad jump" onPointerDown={touchJump}>⤒</button>
        </div>
      </div>
      <RopeStyles />
    </div>
  );
}

function drawBlob(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, face: HTMLImageElement | null) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, BLOB_R, 0, Math.PI * 2);
  ctx.fill();
  if (face) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, BLOB_R - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, x - BLOB_R + 4, y - BLOB_R + 4, (BLOB_R - 4) * 2, (BLOB_R - 4) * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#2b2320';
    ctx.beginPath();
    ctx.arc(x - 7, y - 3, 2.6, 0, Math.PI * 2);
    ctx.arc(x + 7, y - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2320';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y + 4, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, BLOB_R, 0, Math.PI * 2);
  ctx.stroke();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function RopeStyles() {
  return (
    <style jsx global>{`
      .rope-wrap { position: relative; width: min(880px, 100%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .rope-wrap .panel { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; text-align: center; }
      .rope-wrap .panel h3 { font-size: 1.35rem; color: var(--pink-deep); }
      .rope-wrap .panel p { font-size: 0.9rem; color: var(--brown); max-width: 460px; }
      .rope-wrap .big-emoji { font-size: 2.6rem; }
      .rope-wrap .levels { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
      .rope-wrap .level-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 140px; padding: 18px 10px; background: var(--cream); border: 2.5px solid var(--brown); border-radius: 16px; box-shadow: var(--shadow-sm); transition: transform 0.12s ease; }
      .rope-wrap .level-btn:hover:not(:disabled) { transform: translateY(-3px); }
      .rope-wrap .level-btn:disabled { opacity: 0.7; }
      .rope-wrap .level-btn span { font-size: 1.7rem; }
      .rope-wrap .level-btn strong { font-family: var(--font-display); font-size: 0.95rem; color: var(--brown); }
      .rope-wrap .level-btn .stamp { font-style: normal; font-size: 0.68rem; font-weight: 800; color: #2e7d4f; background: #d8f5e3; border-radius: 999px; padding: 1px 10px; }
      .rope-wrap .controls-hint { font-size: 0.74rem !important; color: var(--brown-soft) !important; }
      .rope-wrap .hud-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
      .rope-wrap .pill { background: #fff; border: 2.5px solid var(--brown); border-radius: 999px; padding: 3px 14px; font-weight: 800; font-size: 0.8rem; color: var(--brown); box-shadow: var(--shadow-sm); }
      .rope-wrap .pill.giggle { border-color: var(--pink); color: var(--pink-deep); }
      .rope-wrap .mini { font-size: 0.78rem; padding: 0.35em 0.9em; }
      .rope-wrap .stage { position: relative; width: 100%; }
      .rope-wrap .stage canvas { display: block; width: 100%; height: auto; border: 3px solid var(--brown); border-radius: 18px; box-shadow: var(--shadow-md); background: #fff8f0; }
      .rope-wrap .loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; color: var(--brown-soft); }
      .rope-wrap .hint { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--brown-soft); pointer-events: none; }
      .rope-wrap .won { position: absolute; inset: 0; margin: auto; width: min(400px, 92%); height: fit-content; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px; text-align: center; z-index: 3; }
      .rope-wrap .won h3 { color: var(--pink-deep); }
      .rope-wrap .row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
      .rope-wrap .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); }
      .rope-wrap .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
      .rope-wrap .pads { display: none; width: 100%; justify-content: space-between; padding: 0 6px; }
      .rope-wrap .pad-group { display: flex; gap: 8px; }
      .rope-wrap .pad { width: 58px; height: 58px; border-radius: 50%; border: 3px solid var(--brown); background: rgba(255,255,255,0.85); font-size: 1.3rem; color: var(--brown); box-shadow: var(--shadow-sm); touch-action: none; }
      .rope-wrap .pad.jump { background: var(--blush); }
      .rope-wrap .pad.hold { background: #e2d6ff; }
      @media (pointer: coarse) { .rope-wrap .pads { display: flex; } }
    `}</style>
  );
}
