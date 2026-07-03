'use client';
import { FILTERS, type FilterId } from '@/lib/shaders/filters';
import { useBoothStore } from '@/store/useBoothStore';
import { play } from '@/lib/sound/sound';

/** Per-filter swatch tints so each knob hints at its look. */
const TINTS: Record<FilterId, string> = {
  original: 'radial-gradient(circle at 30% 30%, #fff, #e8e0d8)',
  film: 'radial-gradient(circle at 30% 30%, #ffe9c9, #d8a86b)',
  peach: 'radial-gradient(circle at 30% 30%, #ffe3dd, #ff9d92)',
  mono: 'radial-gradient(circle at 30% 30%, #f2f2f2, #6d6d6d)',
  retro: 'radial-gradient(circle at 30% 30%, #ffe9b8, #c98d4e)',
  cool: 'radial-gradient(circle at 30% 30%, #e3f1ff, #7db4e8)',
  vhs: 'linear-gradient(135deg, #7de0e0 0 45%, #ff8fab 55% 100%)',
  halation: 'radial-gradient(circle at 40% 35%, #fff6f0, #ffb08a)',
  pop: 'conic-gradient(#ff6b93, #ffe8a3, #7de0a0, #7db4e8, #ff6b93)',
  noir: 'radial-gradient(circle at 30% 30%, #cfcfcf, #1c1c1c)',
  fisheye: 'radial-gradient(circle at 50% 45%, #fff 20%, #bde0fe 70%)',
  mirror: 'linear-gradient(90deg, #ffd6e0 0 50%, #ffb3c6 50% 100%)',
};

/** Horizontal rail of filter "knob" cards under the mirror screen. */
export function FilterRail() {
  const filterId = useBoothStore((s) => s.filterId);
  const setFilter = useBoothStore((s) => s.setFilter);

  return (
    <div className="filter-rail" role="listbox" aria-label="pick a filter">
      <span className="label-spaced rail-title">p i c k&nbsp;&nbsp;a&nbsp;&nbsp;f i l t e r</span>
      <div className="rail-track scroll-x">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="option"
            aria-selected={filterId === f.id}
            className={`filter-knob ${filterId === f.id ? 'active' : ''}`}
            onClick={() => { setFilter(f.id); play('pop'); }}
          >
            <span className="knob-dot" style={{ background: TINTS[f.id] }} />
            <span className="knob-label">{f.label}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .filter-rail {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        .rail-title {
          text-align: center;
        }
        .rail-track {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 6px 4px 10px;
          scroll-snap-type: x mandatory;
        }
        .rail-track::-webkit-scrollbar { height: 6px; }
        .rail-track::-webkit-scrollbar-thumb { background: var(--blush); border-radius: 6px; }
        .filter-knob {
          flex: 0 0 auto;
          scroll-snap-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          background: var(--white);
          border: 2px dashed var(--brown-soft);
          border-radius: 16px;
          padding: 8px 12px;
          min-width: 62px;
          box-shadow: var(--shadow-sm);
          transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s;
        }
        .filter-knob:hover { transform: translateY(-2px); }
        .filter-knob.active {
          background: var(--blush);
          border: 2.5px solid var(--brown);
          border-style: solid;
        }
        .knob-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid var(--brown);
          box-shadow: inset -2px -2px 0 rgba(107, 79, 79, 0.15);
        }
        .knob-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--brown);
        }
      `}</style>
    </div>
  );
}
