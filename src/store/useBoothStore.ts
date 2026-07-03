'use client';

import { create } from 'zustand';
import { FilterId, NEUTRAL_ADJUST, type AdjustState } from '@/lib/shaders/filters';
import { LS_KEYS, RECENT_STRIPS_MAX } from '@/config/app';

export type Phase = 'landing' | 'entering' | 'capture' | 'printing' | 'edit';
export type CaptureMode = 'classic' | 'single' | 'burst' | 'boomerang' | 'smile';

export interface DuoState {
  active: boolean;
  role: 'host' | 'guest' | null;
  code: string | null;
  partnerName: string | null;
  connected: boolean;
}

/** A captured shot stores the RAW (unfiltered) frame so edit can re-filter it. */
export interface Shot {
  id: string;
  /** clean webcam frame, mirror already baked in per user setting */
  sourceDataURL: string;
  width: number;
  height: number;
}

export type StripLayout = '4x1' | '2x2' | '3x1' | 'featured' | 'polaroid';
export type CornerStyle = 'rounded' | 'square';

export interface Sticker {
  id: string;
  kind: 'svg' | 'text';
  /** svg key OR the text string */
  content: string;
  x: number; // 0..1 relative to strip preview
  y: number;
  scale: number;
  rotation: number; // deg
  color?: string;
  font?: string;
}

export interface EditState {
  layout: StripLayout;
  filterId: FilterId; // strip-level filter override
  frameColor: string;
  corners: CornerStyle;
  caption: string;
  showDate: boolean;
  showFooter: boolean;
  adjust: AdjustState;
  stickers: Sticker[];
}

export interface RecentStrip {
  id: string;
  thumb: string; // small dataURL
  createdAt: number;
}

interface BoothState {
  // ── global ──
  phase: Phase;
  liteMode: boolean;
  muted: boolean;
  mirror: boolean;
  userName: string | null;
  nameAsked: boolean;

  // ── capture ──
  captureMode: CaptureMode;
  filterId: FilterId;
  countdownSeconds: 3 | 5 | 10;
  shots: Shot[];
  burstPool: Shot[]; // for burst mode selection
  boomerangUrl: string | null; // object URL of encoded gif
  isCapturing: boolean;

  // ── edit (with history) ──
  edit: EditState;
  past: EditState[];
  future: EditState[];

  recentStrips: RecentStrip[];

  // ── duo (booth for two) ──
  duo: DuoState;
  setDuo: (patch: Partial<DuoState>) => void;
  resetDuo: () => void;

  // ── actions ──
  setPhase: (p: Phase) => void;
  setLite: (v: boolean) => void;
  toggleMute: () => void;
  toggleMirror: () => void;
  setUserName: (n: string) => void;
  markNameAsked: () => void;

  setMode: (m: CaptureMode) => void;
  setFilter: (f: FilterId) => void;
  cycleFilter: (dir: 1 | -1) => void;
  setCountdown: (s: 3 | 5 | 10) => void;

  addShot: (s: Shot) => void;
  replaceLastShot: (s: Shot) => void;
  setShots: (s: Shot[]) => void;
  setBurstPool: (s: Shot[]) => void;
  clearShots: () => void;
  setCapturing: (v: boolean) => void;
  setBoomerang: (url: string | null) => void;

  // edit mutations (history-tracked)
  patchEdit: (patch: Partial<EditState>) => void;
  /** snapshot current edit into history (call at the start of a drag). */
  beginEdit: () => void;
  /** mutate edit WITHOUT touching history (live drags/sliders). */
  setEditRaw: (patch: Partial<EditState>) => void;
  addSticker: (s: Sticker) => void;
  updateSticker: (id: string, patch: Partial<Sticker>) => void;
  removeSticker: (id: string) => void;
  undo: () => void;
  redo: () => void;
  resetEdit: () => void;

  saveRecentStrip: (thumb: string) => void;
  hydrate: () => void;
  reset: () => void;
}

const FILTER_ORDER: FilterId[] = [
  'original', 'film', 'peach', 'mono', 'retro', 'cool',
  'vhs', 'halation', 'pop', 'noir', 'fisheye', 'mirror',
];

const defaultEdit = (): EditState => ({
  layout: '4x1',
  filterId: 'peach',
  frameColor: '#FFF8F0',
  corners: 'rounded',
  caption: '',
  showDate: true,
  showFooter: true,
  adjust: { ...NEUTRAL_ADJUST },
  stickers: [],
});

const HISTORY_LIMIT = 24;

export const useBoothStore = create<BoothState>((set, get) => {
  // helper: push current edit onto history before a change
  const commit = (mutator: (e: EditState) => EditState) =>
    set((state) => {
      const past = [...state.past, state.edit].slice(-HISTORY_LIMIT);
      return { edit: mutator(state.edit), past, future: [] };
    });

  return {
    phase: 'landing',
    liteMode: false,
    muted: false,
    mirror: true,
    userName: null,
    nameAsked: false,

    captureMode: 'classic',
    filterId: 'peach',
    countdownSeconds: 3,
    shots: [],
    burstPool: [],
    boomerangUrl: null,
    isCapturing: false,

    edit: defaultEdit(),
    past: [],
    future: [],
    recentStrips: [],

    duo: { active: false, role: null, code: null, partnerName: null, connected: false },
    setDuo: (patch) => set((s) => ({ duo: { ...s.duo, ...patch } })),
    resetDuo: () =>
      set({ duo: { active: false, role: null, code: null, partnerName: null, connected: false } }),

    setPhase: (p) => set({ phase: p }),
    setLite: (v) => {
      set({ liteMode: v });
      try { localStorage.setItem(LS_KEYS.liteMode, v ? '1' : '0'); } catch {}
    },
    toggleMute: () => {
      const next = !get().muted;
      set({ muted: next });
      try { localStorage.setItem(LS_KEYS.muted, next ? '1' : '0'); } catch {}
    },
    toggleMirror: () => {
      const next = !get().mirror;
      set({ mirror: next });
      try { localStorage.setItem(LS_KEYS.mirror, next ? '1' : '0'); } catch {}
    },
    setUserName: (n) => {
      set({ userName: n, nameAsked: true });
      try { localStorage.setItem(LS_KEYS.name, n); } catch {}
    },
    markNameAsked: () => set({ nameAsked: true }),

    setMode: (m) => set({ captureMode: m }),
    setFilter: (f) => set({ filterId: f }),
    cycleFilter: (dir) => {
      const cur = get().filterId;
      const i = FILTER_ORDER.indexOf(cur);
      const next = FILTER_ORDER[(i + dir + FILTER_ORDER.length) % FILTER_ORDER.length];
      set({ filterId: next });
    },
    setCountdown: (s) => set({ countdownSeconds: s }),

    addShot: (s) => set((st) => ({ shots: [...st.shots, s] })),
    replaceLastShot: (s) =>
      set((st) => ({ shots: [...st.shots.slice(0, -1), s] })),
    setShots: (s) => set({ shots: s }),
    setBurstPool: (s) => set({ burstPool: s }),
    clearShots: () => set({ shots: [], burstPool: [], boomerangUrl: null }),
    setCapturing: (v) => set({ isCapturing: v }),
    setBoomerang: (url) => set({ boomerangUrl: url }),

    patchEdit: (patch) => commit((e) => ({ ...e, ...patch })),
    beginEdit: () =>
      set((state) => ({ past: [...state.past, state.edit].slice(-HISTORY_LIMIT), future: [] })),
    setEditRaw: (patch) => set((state) => ({ edit: { ...state.edit, ...patch } })),
    addSticker: (s) => commit((e) => ({ ...e, stickers: [...e.stickers, s] })),
    updateSticker: (id, patch) =>
      // sticker drags update continuously; coalesce by not spamming history here.
      set((state) => ({
        edit: {
          ...state.edit,
          stickers: state.edit.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        },
      })),
    removeSticker: (id) =>
      commit((e) => ({ ...e, stickers: e.stickers.filter((s) => s.id !== id) })),

    undo: () =>
      set((state) => {
        if (!state.past.length) return state;
        const prev = state.past[state.past.length - 1];
        return {
          edit: prev,
          past: state.past.slice(0, -1),
          future: [state.edit, ...state.future].slice(0, HISTORY_LIMIT),
        };
      }),
    redo: () =>
      set((state) => {
        if (!state.future.length) return state;
        const next = state.future[0];
        return {
          edit: next,
          past: [...state.past, state.edit].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
        };
      }),
    resetEdit: () => set({ edit: defaultEdit(), past: [], future: [] }),

    saveRecentStrip: (thumb) => {
      const strip: RecentStrip = { id: crypto.randomUUID(), thumb, createdAt: Date.now() };
      const next = [strip, ...get().recentStrips].slice(0, RECENT_STRIPS_MAX);
      set({ recentStrips: next });
      try {
        localStorage.setItem(LS_KEYS.recentStrips, JSON.stringify(next));
      } catch {}
    },

    hydrate: () => {
      if (typeof window === 'undefined') return;
      try {
        const name = localStorage.getItem(LS_KEYS.name);
        const muted = localStorage.getItem(LS_KEYS.muted) === '1';
        const mirrorRaw = localStorage.getItem(LS_KEYS.mirror);
        const lite = localStorage.getItem(LS_KEYS.liteMode) === '1';
        const recentRaw = localStorage.getItem(LS_KEYS.recentStrips);
        set({
          userName: name,
          nameAsked: !!name,
          muted,
          mirror: mirrorRaw === null ? true : mirrorRaw === '1',
          liteMode: lite,
          recentStrips: recentRaw ? JSON.parse(recentRaw) : [],
          edit: name ? { ...defaultEdit(), caption: name } : defaultEdit(),
        });
      } catch {}
    },

    reset: () =>
      set({
        phase: 'landing',
        shots: [],
        burstPool: [],
        boomerangUrl: null,
        isCapturing: false,
        edit: get().userName ? { ...defaultEdit(), caption: get().userName! } : defaultEdit(),
        past: [],
        future: [],
      }),
  };
});
