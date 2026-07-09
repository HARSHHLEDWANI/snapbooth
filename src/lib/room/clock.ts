'use client';

/**
 * clock.ts — cross-peer clock agreement for the synced countdown.
 *
 * THE COUNTDOWN-SYNC PROTOCOL
 * ───────────────────────────
 * The HOST is the authoritative clock. The problem: "capture in 3 seconds"
 * means nothing across the wire unless both sides agree what "now" is, and
 * `Date.now()` on two laptops can disagree by seconds.
 *
 * We solve it NTP-style over the data channel:
 *
 *   guest                         host
 *     │  ping { tSent }            │
 *     ├───────────────────────────▶│
 *     │            pong { tSent, tHost }
 *     │◀───────────────────────────┤
 *   receive at tRecv
 *
 *   rtt    = tRecv - tSent
 *   offset = tHost - (tSent + rtt / 2)     // "host clock minus my clock"
 *
 * We take several samples and keep the offset from the sample with the
 * LOWEST rtt (least queueing noise). Then:
 *
 *   hostNow()             = Date.now() + offset          (on the guest)
 *   toLocal(hostTime)     = hostTime  - offset
 *
 * To fire a capture, the host broadcasts `fire_at = hostNow() + lead` and
 * BOTH sides schedule their own local countdown to end at that host-clock
 * instant. Each side grabs its own webcam at native resolution at the beat —
 * no frames cross the wire until after the shutter.
 */

export interface PingMsg { t: 'ping'; id: number; tSent: number }
export interface PongMsg { t: 'pong'; id: number; tSent: number; tHost: number }

const SAMPLES = 5;
const SAMPLE_GAP_MS = 250;

export class ClockSync {
  /** host-clock minus local-clock, from the cleanest sample. 0 on the host. */
  private offset = 0;
  private bestRtt = Infinity;
  private nextId = 1;
  private pending = new Map<number, number>(); // id → tSent
  private sampled = 0;

  constructor(private readonly isHost: boolean) {}

  /** Kick off a sampling burst (guest side). Safe to call repeatedly. */
  start(send: (msg: PingMsg) => void) {
    if (this.isHost) return;
    this.sampled = 0;
    const tick = () => {
      if (this.sampled >= SAMPLES) return;
      this.sampled++;
      const id = this.nextId++;
      this.pending.set(id, Date.now());
      send({ t: 'ping', id, tSent: Date.now() });
      setTimeout(tick, SAMPLE_GAP_MS);
    };
    tick();
  }

  /** Host side: answer a ping with our clock reading. */
  answer(msg: PingMsg): PongMsg {
    return { t: 'pong', id: msg.id, tSent: msg.tSent, tHost: Date.now() };
  }

  /** Guest side: fold a pong into the offset estimate. */
  absorb(msg: PongMsg) {
    const tRecv = Date.now();
    this.pending.delete(msg.id);
    const rtt = tRecv - msg.tSent;
    if (rtt < this.bestRtt) {
      this.bestRtt = rtt;
      this.offset = msg.tHost - (msg.tSent + rtt / 2);
    }
  }

  /** Current time on the HOST's clock (identity on the host itself). */
  hostNow(): number {
    return Date.now() + (this.isHost ? 0 : this.offset);
  }

  /** Convert a host-clock timestamp into this device's local clock. */
  toLocal(hostTime: number): number {
    return hostTime - (this.isHost ? 0 : this.offset);
  }

  /** Best round-trip seen (ms) — used to size the countdown lead. */
  rtt(): number {
    return this.bestRtt === Infinity ? 200 : this.bestRtt;
  }
}
