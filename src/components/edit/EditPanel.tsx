'use client';

import { useState } from 'react';
import { useBoothStore, type StripLayout } from '@/store/useBoothStore';
import { FILTERS } from '@/lib/shaders/filters';
import { FRAME_COLORS } from '@/config/app';
import { STICKERS, StickerSvg } from '@/lib/stickers';
import { play } from '@/lib/sound/sound';

type Tab = 'layout' | 'frame' | 'filter' | 'adjust' | 'stickers';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'layout', label: 'layout', icon: '🖼️' },
  { id: 'frame', label: 'frame', icon: '🎀' },
  { id: 'filter', label: 'filter', icon: '✨' },
  { id: 'adjust', label: 'adjust', icon: '🎛️' },
  { id: 'stickers', label: 'stickers', icon: '💗' },
];

const LAYOUTS: { id: StripLayout; label: string; art: string }[] = [
  { id: '4x1', label: '4×1 classic', art: '▭▭▭▭' },
  { id: '2x2', label: '2×2 grid', art: '▛▜' },
  { id: '3x1', label: '3×1', art: '▭▭▭' },
  { id: 'featured', label: '1 + 3', art: '▬' },
  { id: 'polaroid', label: 'polaroid', art: '◻' },
];

const TEXT_FONTS = [
  { label: 'hand', value: "'Gochi Hand', cursive" },
  { label: 'round', value: "'Baloo 2', sans-serif" },
  { label: 'clean', value: "'Quicksand', sans-serif" },
  { label: 'serif', value: 'Georgia, serif' },
];

export function EditPanel() {
  const [tab, setTab] = useState<Tab>('filter');
  const edit = useBoothStore((s) => s.edit);
  const patchEdit = useBoothStore((s) => s.patchEdit);
  const beginEdit = useBoothStore((s) => s.beginEdit);
  const setEditRaw = useBoothStore((s) => s.setEditRaw);
  const addSticker = useBoothStore((s) => s.addSticker);
  const [textVal, setTextVal] = useState('');
  const [textFont, setTextFont] = useState(TEXT_FONTS[0].value);
  const [textColor, setTextColor] = useState('#FF8FAB');

  const slider = (key: keyof typeof edit.adjust, label: string, min = -1, max = 1) => (
    <label className="slider-row" key={key}>
      <span>{label}</span>
      <input
        type="range" min={min} max={max} step={0.02}
        value={edit.adjust[key]}
        onPointerDown={beginEdit}
        onChange={(e) => setEditRaw({ adjust: { ...edit.adjust, [key]: parseFloat(e.target.value) } })}
      />
    </label>
  );

  return (
    <div className="panel card grain">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => { setTab(t.id); play('pop'); }}
          >
            <span className="tab-ico">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="tab-body scroll-y">
        {tab === 'layout' && (
          <div className="grid2">
            {LAYOUTS.map((l) => (
              <button key={l.id} className={`opt ${edit.layout === l.id ? 'on' : ''}`} onClick={() => patchEdit({ layout: l.id })}>
                <span className="opt-art">{l.art}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'frame' && (
          <div className="stack">
            <span className="label-spaced">f r a m e&nbsp;&nbsp;c o l o r</span>
            <div className="swatches">
              {FRAME_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`swatch ${edit.frameColor === c.value ? 'on' : ''}`}
                  style={{ background: c.value.startsWith('pattern') ? undefined : c.value }}
                  data-pattern={c.value.startsWith('pattern') ? c.id : undefined}
                  onClick={() => patchEdit({ frameColor: c.value })}
                  title={c.label}
                />
              ))}
            </div>

            <span className="label-spaced">c o r n e r s</span>
            <div className="row">
              <button className={`chip ${edit.corners === 'rounded' ? 'active' : ''}`} onClick={() => patchEdit({ corners: 'rounded' })}>rounded</button>
              <button className={`chip ${edit.corners === 'square' ? 'active' : ''}`} onClick={() => patchEdit({ corners: 'square' })}>square</button>
            </div>

            <span className="label-spaced">c a p t i o n</span>
            <input className="text-in" value={edit.caption} maxLength={26} placeholder="add names / a note ♡"
              onChange={(e) => setEditRaw({ caption: e.target.value })}
              onFocus={beginEdit}
            />
            <span className="label-spaced">y o u r&nbsp;&nbsp;c i t i e s</span>
            <input className="text-in" value={edit.cities} maxLength={30} placeholder="pune ↔ toronto (optional)"
              onChange={(e) => setEditRaw({ cities: e.target.value })}
              onFocus={beginEdit}
            />
            <label className="toggle"><input type="checkbox" checked={edit.showDate} onChange={(e) => patchEdit({ showDate: e.target.checked })} /> date stamp</label>
            <label className="toggle"><input type="checkbox" checked={edit.showFooter} onChange={(e) => patchEdit({ showFooter: e.target.checked })} /> show footer line</label>
          </div>
        )}

        {tab === 'filter' && (
          <div className="grid3">
            {FILTERS.map((f) => (
              <button key={f.id} className={`opt small ${edit.filterId === f.id ? 'on' : ''}`} onClick={() => patchEdit({ filterId: f.id })}>
                <span className="knob-dot" />{f.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'adjust' && (
          <div className="stack">
            {slider('brightness', 'brightness')}
            {slider('contrast', 'contrast')}
            {slider('saturation', 'saturation')}
            {slider('warmth', 'warmth')}
            {slider('grain', 'grain', 0, 1)}
            <button className="btn btn-ghost mini" onClick={() => patchEdit({ adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, grain: 0 } })}>reset adjust</button>
          </div>
        )}

        {tab === 'stickers' && (
          <div className="stack">
            <div className="text-sticker card-dashed">
              <input className="text-in" value={textVal} maxLength={18} placeholder="type text…" onChange={(e) => setTextVal(e.target.value)} />
              <div className="row wrap">
                {TEXT_FONTS.map((f) => (
                  <button key={f.label} className={`chip ${textFont === f.value ? 'active' : ''}`} style={{ fontFamily: f.value }} onClick={() => setTextFont(f.value)}>{f.label}</button>
                ))}
              </div>
              <div className="row wrap">
                {['#FF8FAB', '#FF6B93', '#6B4F4F', '#BDE0FE', '#FFC94D', '#ffffff'].map((c) => (
                  <button key={c} className={`dotc ${textColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setTextColor(c)} />
                ))}
              </div>
              <button className="btn btn-primary mini" disabled={!textVal.trim()} onClick={() => {
                addSticker({ id: crypto.randomUUID(), kind: 'text', content: textVal.trim(), x: 0.5, y: 0.5, scale: 1, rotation: 0, color: textColor, font: textFont });
                setTextVal(''); play('pop');
              }}>+ add text</button>
            </div>
            <span className="label-spaced">t a p&nbsp;&nbsp;t o&nbsp;&nbsp;a d d</span>
            <div className="sticker-grid">
              {STICKERS.map((s) => (
                <button key={s.key} className="sticker-btn" onClick={() => {
                  addSticker({ id: crypto.randomUUID(), kind: 'svg', content: s.key, x: 0.5, y: 0.4 + Math.random() * 0.2, scale: 1, rotation: 0 });
                  play('pop');
                }} title={s.label}>
                  <StickerSvg def={s} size={38} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .panel { position: relative; display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 0; }
        .tabs { display: flex; gap: 2px; padding: 8px 8px 0; flex-wrap: wrap; }
        .tab { flex: 1; min-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border: 2px solid transparent; border-bottom: none; border-radius: 12px 12px 0 0; background: var(--blush); color: var(--brown); font-weight: 700; font-size: 0.78rem; }
        .tab.on { background: var(--white); border-color: var(--brown); }
        .tab-ico { font-size: 1.1rem; }
        .tab-body { flex: 1; padding: 14px; border-top: 2.5px solid var(--brown); }
        .stack { display: flex; flex-direction: column; gap: 10px; }
        .row { display: flex; gap: 8px; }
        .row.wrap { flex-wrap: wrap; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .opt { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border: 2px dashed var(--brown-soft); border-radius: 14px; background: var(--white); font-weight: 700; font-size: 0.8rem; color: var(--brown); }
        .opt.small { padding: 9px 4px; font-size: 0.72rem; }
        .opt.on { border-style: solid; border-color: var(--brown); background: var(--blush); }
        .opt-art { font-size: 1.3rem; letter-spacing: -2px; color: var(--pink); }
        .knob-dot { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff, var(--pink)); border: 2px solid var(--brown); }
        .swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .swatch { aspect-ratio: 1; border-radius: 10px; border: 2.5px solid var(--brown); box-shadow: var(--shadow-sm); }
        .swatch.on { outline: 3px solid var(--pink); outline-offset: 2px; }
        .swatch[data-pattern='checkered'] { background: repeating-conic-gradient(#ffd6e0 0 25%, #fff 0 50%) 0 0 / 14px 14px; }
        .swatch[data-pattern='gingham'] { background: repeating-linear-gradient(0deg, rgba(189,224,254,0.6) 0 4px, transparent 4px 8px), repeating-linear-gradient(90deg, rgba(189,224,254,0.6) 0 4px, #fff 4px 8px); }
        .text-in { width: 100%; padding: 10px; border: 2px dashed var(--pink); border-radius: 12px; background: var(--cream); color: var(--brown); }
        .toggle { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.88rem; }
        .toggle input { width: 18px; height: 18px; accent-color: var(--pink); }
        .slider-row { display: flex; flex-direction: column; gap: 2px; font-weight: 700; font-size: 0.82rem; }
        .slider-row input { width: 100%; accent-color: var(--pink); }
        .text-sticker { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 2px dashed var(--brown-soft); border-radius: 14px; }
        .dotc { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--brown); }
        .dotc.on { outline: 2px solid var(--pink); outline-offset: 2px; }
        .sticker-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .sticker-btn { aspect-ratio: 1; display: grid; place-items: center; border: 2px solid transparent; border-radius: 12px; background: var(--cream); }
        .sticker-btn:hover { background: var(--blush); border-color: var(--brown); transform: translateY(-2px); }
        .mini { font-size: 0.82rem; padding: 0.45em 1em; align-self: flex-start; }
      `}</style>
    </div>
  );
}
