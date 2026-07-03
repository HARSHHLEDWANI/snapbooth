'use client';

/**
 * room.ts — the "booth for two" plumbing. Peer-to-peer over WebRTC using the
 * free public PeerJS cloud for signalling (no backend of our own).
 *
 *   host: creates a room  →  peer id  "snapbooth-<code>"
 *   guest: opens the shared link (?room=<code>) and connects.
 *
 * One data connection carries the JSON protocol below; one media call carries
 * each person's live webcam so both see each other in the booth.
 *
 * Design: both sides run the SAME capture logic. Whoever presses SNAP
 * broadcasts `capture-start`; both run the countdown locally, shoot at the
 * same beats, and exchange downscaled frames. Every combined shot is built
 * host-left/guest-right on BOTH ends, so the two strips are identical.
 */

import type Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import type { CaptureMode, EditState } from '@/store/useBoothStore';
import type { FilterId } from '@/lib/shaders/filters';

export type DuoRole = 'host' | 'guest';

// ── protocol ──────────────────────────────────────────────────────────────
export type DuoMessage =
  | { t: 'hello'; name: string }
  | { t: 'capture-start'; mode: CaptureMode; countdown: number; shots: number }
  | { t: 'frame'; index: number; jpeg: string }
  | { t: 'burst-pick'; indices: number[] }
  | { t: 'filter'; id: FilterId }
  | { t: 'go-edit' }
  | { t: 'edit'; edit: EditState }
  | { t: 'retake' }
  | { t: 'bye' };

type Listener = (msg: DuoMessage) => void;

export interface DuoRoom {
  role: DuoRole;
  code: string;
  /** resolves when the data channel is open */
  ready: Promise<void>;
  send: (msg: DuoMessage) => void;
  on: (fn: Listener) => () => void;
  /** provide the local webcam; establishes/answers the media call */
  attachStream: (stream: MediaStream) => void;
  onRemoteStream: (fn: (s: MediaStream) => void) => void;
  remoteStream: MediaStream | null;
  connected: () => boolean;
  destroy: () => void;
}

const PREFIX = 'snapbooth-v1-';

export const makeRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

export const roomLink = (code: string) =>
  `${location.origin}${location.pathname}?room=${code}`;

let active: DuoRoom | null = null;
export const getActiveRoom = () => active;

async function newPeer(id?: string): Promise<Peer> {
  const { default: PeerCtor } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const p = new PeerCtor(id as string, { debug: 1 });
    const timer = setTimeout(() => reject(new Error('signalling timeout')), 15000);
    p.on('open', () => { clearTimeout(timer); resolve(p); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function wire(
  peer: Peer,
  role: DuoRole,
  code: string,
  conn: DataConnection,
  connReady: Promise<void>,
): DuoRoom {
  const listeners = new Set<Listener>();
  let localStream: MediaStream | null = null;
  let call: MediaConnection | null = null;
  let pendingCall: MediaConnection | null = null;
  let remoteStream: MediaStream | null = null;
  const remoteStreamFns = new Set<(s: MediaStream) => void>();

  conn.on('data', (data) => {
    try {
      const msg = (typeof data === 'string' ? JSON.parse(data) : data) as DuoMessage;
      listeners.forEach((fn) => fn(msg));
    } catch { /* ignore malformed */ }
  });

  const handleCallStream = (c: MediaConnection) => {
    c.on('stream', (s) => {
      remoteStream = s;
      remoteStreamFns.forEach((fn) => fn(s));
    });
  };

  // guest side: host calls us — answer once we have a stream
  peer.on('call', (incoming) => {
    if (localStream) {
      incoming.answer(localStream);
      call = incoming;
      handleCallStream(incoming);
    } else {
      pendingCall = incoming;
    }
  });

  const room: DuoRoom = {
    role,
    code,
    ready: connReady,
    send: (msg) => { if (conn.open) conn.send(JSON.stringify(msg)); },
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    attachStream: (stream) => {
      localStream = stream;
      if (pendingCall) {
        pendingCall.answer(stream);
        call = pendingCall;
        handleCallStream(pendingCall);
        pendingCall = null;
      } else if (role === 'host' && !call) {
        // host initiates the call
        connReady.then(() => {
          if (!call && localStream) {
            call = peer.call(PREFIX + code + '-g', localStream);
            if (call) handleCallStream(call);
          }
        });
      }
    },
    onRemoteStream: (fn) => {
      remoteStreamFns.add(fn);
      if (remoteStream) fn(remoteStream);
    },
    get remoteStream() { return remoteStream; },
    connected: () => conn.open,
    destroy: () => {
      try { conn.open && conn.send(JSON.stringify({ t: 'bye' })); } catch {}
      try { call?.close(); } catch {}
      try { conn.close(); } catch {}
      try { peer.destroy(); } catch {}
      if (active === room) active = null;
    },
  };
  active = room;
  return room;
}

/** Host: claim the room id and wait for a guest to connect. */
export async function createRoom(code: string): Promise<DuoRoom> {
  const peer = await newPeer(PREFIX + code);
  let resolveConn!: (c: DataConnection) => void;
  const connP = new Promise<DataConnection>((r) => { resolveConn = r; });
  peer.on('connection', (c) => resolveConn(c));
  const conn = await connP;
  const ready = new Promise<void>((r) => (conn.open ? r() : conn.on('open', () => r())));
  return wire(peer, 'host', code, conn, ready);
}

/** Guest: connect to an existing room. Guest claims "<room>-g" so host can call back. */
export async function joinRoom(code: string): Promise<DuoRoom> {
  const peer = await newPeer(PREFIX + code + '-g');
  const conn = peer.connect(PREFIX + code, { reliable: true });
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('could not reach the room — is your friend still there?')), 15000);
    conn.on('open', () => { clearTimeout(timer); resolve(); });
    peer.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
  await ready;
  return wire(peer, 'guest', code, conn, Promise.resolve());
}

/** Combine two frames into one side-by-side "smashed together" shot.
 *  Host always LEFT, guest always RIGHT — identical on both ends. */
export async function combineFrames(
  hostSrc: string | null,
  guestSrc: string | null,
): Promise<{ dataURL: string; width: number; height: number }> {
  const W = 720; // per half
  const H = 540;
  const canvas = document.createElement('canvas');
  const both = !!hostSrc && !!guestSrc;
  canvas.width = both ? W * 2 : W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFD6E0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const draw = (img: HTMLImageElement, x: number) => {
    // cover-crop into the half
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / s, sh = H / s;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, 0, W, H);
  };
  const load = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });

  const [hi, gi] = await Promise.all([
    hostSrc ? load(hostSrc) : Promise.resolve(null),
    guestSrc ? load(guestSrc) : Promise.resolve(null),
  ]);
  if (hi) draw(hi, 0);
  if (gi) draw(gi, both ? W : 0);
  // slim divider seam
  if (both) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(W - 2, 0, 4, H);
  }
  return { dataURL: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height };
}

/** Downscale a raw frame for sending over the data channel. */
export function downscaleForWire(dataURL: string, targetW = 720, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, targetW / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}
