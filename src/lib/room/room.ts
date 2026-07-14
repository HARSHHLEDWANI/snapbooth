'use client';

/**
 * room.ts — the shared two-person room plumbing. Peer-to-peer over WebRTC
 * using the free public PeerJS cloud for signalling only (no backend of our
 * own, nothing stored anywhere). Swap the broker by editing newPeer().
 *
 *   host:  creates a room →  peer id  "twoplace-v1-<code>"
 *   guest: enters the 5-letter code and connects; claims "<id>-g" so the
 *          host can media-call back deterministically.
 *
 * One data connection carries the JSON protocol below; one media call carries
 * each person's live webcam. The SAME room is reused by the photobooth and
 * every activity (quiz/draw/debate/arcade) — activities multiplex over the
 * `act` message namespace.
 *
 * Captures: the host is the authoritative clock (see clock.ts for the
 * NTP-style offset protocol). Whoever presses SNAP causes the HOST to
 * broadcast `capture-start { fireAt }` in host-clock time; both sides run
 * the countdown locally, shoot their own webcam at native resolution at the
 * same instant, then exchange compressed frames so both end up with the
 * full combined strip (host-left / guest-right on BOTH ends).
 *
 * Rooms are ephemeral: when either tab closes, the peer dies and the code is
 * useless. Nothing persists.
 */

import type Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import type { CaptureMode, EditState, ActivityId } from '@/store/useBoothStore';
import type { FilterId } from '@/lib/shaders/filters';
import type { AccentId } from '@/config/app';
import { ClockSync, type PingMsg, type PongMsg } from './clock';

export type DuoRole = 'host' | 'guest';

// ── protocol ──────────────────────────────────────────────────────────────
export type DuoMessage =
  | { t: 'hello'; accent: AccentId }
  | PingMsg
  | PongMsg
  // capture ­— fireAt is in HOST-clock ms (see clock.ts)
  | { t: 'capture-request'; mode: CaptureMode; countdown: number } // guest → host
  | { t: 'capture-start'; mode: CaptureMode; countdown: number; fireAt: number; retake?: boolean }
  | { t: 'frame'; index: number; jpeg: string }
  | { t: 'gif-frame'; index: number; jpeg: string; total: number }
  | { t: 'burst-pick'; indices: number[] }
  | { t: 'filter'; id: FilterId }
  | { t: 'go-edit' }
  | { t: 'edit'; edit: EditState }
  // mutual retake handshake — either side offers, the other agrees/declines
  | { t: 'retake-offer' }
  | { t: 'retake-agree' }
  | { t: 'retake-decline' }
  // in-room delight
  | { t: 'reaction'; emoji: string }
  | { t: 'pose'; index: number }
  // navigation — pull both people into an activity or back to the booth
  | { t: 'open-activity'; a: ActivityId }
  | { t: 'open-booth' }
  // activity namespace — each activity speaks through its own `a` channel
  | { t: 'act'; a: ActivityId; m: unknown }
  | { t: 'bye' };

type Listener = (msg: DuoMessage) => void;

export interface DuoRoom {
  role: DuoRole;
  code: string;
  /** resolves when the data channel is open */
  ready: Promise<void>;
  /** cross-peer clock agreement (host-authoritative) */
  clock: ClockSync;
  send: (msg: DuoMessage) => void;
  on: (fn: Listener) => () => void;
  /** provide the local webcam; establishes/answers the media call */
  attachStream: (stream: MediaStream) => void;
  onRemoteStream: (fn: (s: MediaStream) => void) => void;
  remoteStream: MediaStream | null;
  connected: () => boolean;
  destroy: () => void;
}

const PREFIX = 'twoplace-v1-';

/** 5 chars from an unambiguous alphabet — no 0/O, no 1/I/L. */
export const makeRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

export const roomLink = (code: string) =>
  `${location.origin}${location.pathname}?room=${code}`;

let active: DuoRoom | null = null;
export const getActiveRoom = () => active;

/**
 * ICE servers. PeerJS's built-in defaults point at turn.peerjs.com, which no
 * longer exists — with them, rooms only connect on the same network. STUN
 * handles friendly NATs; the Metered TURN relay (credentials from
 * dashboard.metered.ca) is the fallback that makes phone↔phone across
 * carriers (CGNAT) work. Frames transit the relay encrypted, never stored.
 */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
  ];
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (username && credential) {
    servers.push(
      { urls: 'turn:global.relay.metered.ca:80', username, credential },
      { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username, credential },
      { urls: 'turn:global.relay.metered.ca:443', username, credential },
      { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username, credential },
    );
  }
  return servers;
}

async function newPeer(id?: string): Promise<Peer> {
  const { default: PeerCtor } = await import('peerjs');
  // Optional self-hosted signalling broker (NEXT_PUBLIC_PEER_HOST/PORT/PATH).
  // Unset = the free PeerJS cloud. The smoke tests point this at a local
  // `npx peerjs` server so CI never depends on the public broker.
  const brokerHost = process.env.NEXT_PUBLIC_PEER_HOST;
  const brokerPort = Number(process.env.NEXT_PUBLIC_PEER_PORT || 443);
  const broker = brokerHost
    ? { host: brokerHost, port: brokerPort, path: process.env.NEXT_PUBLIC_PEER_PATH || '/', secure: brokerPort === 443 }
    : {};
  return new Promise((resolve, reject) => {
    const p = new PeerCtor(id as string, { debug: 1, config: { iceServers: iceServers() }, ...broker });
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
  // messages that arrive before any React listener mounts are buffered and
  // replayed to the first subscriber — avoids losing `hello` etc. to races
  const backlog: DuoMessage[] = [];
  const clock = new ClockSync(role === 'host');
  let localStream: MediaStream | null = null;
  let call: MediaConnection | null = null;
  let pendingCall: MediaConnection | null = null;
  let remoteStream: MediaStream | null = null;
  const remoteStreamFns = new Set<(s: MediaStream) => void>();

  const send = (msg: DuoMessage) => { if (conn.open) conn.send(JSON.stringify(msg)); };

  conn.on('data', (data) => {
    try {
      const msg = (typeof data === 'string' ? JSON.parse(data) : data) as DuoMessage;
      // clock plumbing is handled here so callers never see it
      if (msg.t === 'ping') { send(clock.answer(msg)); return; }
      if (msg.t === 'pong') { clock.absorb(msg); return; }
      if (listeners.size === 0) { backlog.push(msg); return; }
      listeners.forEach((fn) => fn(msg));
    } catch { /* ignore malformed */ }
  });

  // guest measures its offset to the host clock as soon as the channel opens
  connReady.then(() => clock.start(send));

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
    clock,
    send,
    on: (fn) => {
      listeners.add(fn);
      if (backlog.length) {
        const q = backlog.splice(0, backlog.length);
        q.forEach((m) => fn(m));
      }
      return () => listeners.delete(fn);
    },
    attachStream: (stream) => {
      const prev = localStream;
      localStream = stream;
      if (call && prev !== stream) {
        // media call already live (e.g. booth → debate) — swap the tracks
        try {
          const senders = call.peerConnection?.getSenders() ?? [];
          stream.getTracks().forEach((track) => {
            const sender = senders.find((s) => s.track?.kind === track.kind);
            if (sender) sender.replaceTrack(track);
          });
        } catch { /* renegotiation unsupported — keep the old stream */ }
        return;
      }
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
    const timer = setTimeout(() => reject(new Error('could not reach the room — double-check the code, and make sure your person still has it open')), 15000);
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
