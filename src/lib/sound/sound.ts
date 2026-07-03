/**
 * sound.ts — tiny WebAudio-synthesised SFX. No audio files to download; every
 * sound is generated procedurally on first user interaction (autoplay-safe).
 * Respects a global mute flag persisted in localStorage.
 */

import { LS_KEYS } from '@/config/app';

type SoundName =
  | 'shutter'
  | 'whir'
  | 'printer'
  | 'pop'
  | 'countdown'
  | 'success';

let ctx: AudioContext | null = null;
let muted = false;

export function initSound() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') ctx.resume();
  muted = localStorage.getItem(LS_KEYS.muted) === '1';
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(LS_KEYS.muted, next ? '1' : '0');
  } catch {}
}

export function isMuted() {
  return muted;
}

function env(node: AudioNode, gain: GainNode, t: number, attack: number, decay: number, peak = 0.4) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function play(name: SoundName) {
  if (muted || !ctx) return;
  const c = ctx;
  const t = c.currentTime;

  switch (name) {
    case 'shutter': {
      // mechanical "cha-chk": short filtered noise burst + click transient
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.09);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 0.8;
      const g = c.createGain();
      env(g, g, t, 0.002, 0.07, 0.5);
      src.connect(bp).connect(g).connect(c.destination);
      src.start(t);
      src.stop(t + 0.1);
      break;
    }
    case 'whir': {
      // film-advance motor whir: sawtooth ramping up then down
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(180, t + 0.18);
      osc.frequency.linearRampToValueAtTime(70, t + 0.34);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = c.createGain();
      env(g, g, t, 0.03, 0.33, 0.16);
      osc.connect(lp).connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.4);
      break;
    }
    case 'printer': {
      // buzzy printer: square wave with vibrato + noise
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 120;
      const lfo = c.createOscillator();
      lfo.frequency.value = 26;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 20;
      lfo.connect(lfoGain).connect(osc.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.05);
      g.gain.setValueAtTime(0.14, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      osc.connect(lp).connect(g).connect(c.destination);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 1.0);
      lfo.stop(t + 1.0);
      break;
    }
    case 'pop': {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
      const g = c.createGain();
      env(g, g, t, 0.004, 0.07, 0.25);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.09);
      break;
    }
    case 'countdown': {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 660;
      const g = c.createGain();
      env(g, g, t, 0.005, 0.12, 0.2);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.14);
      break;
    }
    case 'success': {
      // little arpeggio
      [523, 659, 784, 1047].forEach((f, i) => {
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = c.createGain();
        const st = t + i * 0.08;
        env(g, g, st, 0.005, 0.16, 0.18);
        osc.connect(g).connect(c.destination);
        osc.start(st);
        osc.stop(st + 0.2);
      });
      break;
    }
  }
}
