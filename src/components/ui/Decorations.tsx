'use client';
import { useMemo } from 'react';

/** Floating pastel clouds / hearts / sparkles behind the UI. Pure CSS, cheap. */
export function Decorations({ dense = false }: { dense?: boolean }) {
  const items = useMemo(() => {
    const kinds = ['heart', 'cloud', 'sparkle', 'star', 'bow'] as const;
    const n = dense ? 14 : 9;
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      kind: kinds[i % kinds.length],
      left: `${(i * 37 + 8) % 96}%`,
      top: `${(i * 53 + 6) % 90}%`,
      size: 26 + ((i * 13) % 34),
      dur: 5 + ((i * 7) % 6),
      delay: (i % 5) * 0.7,
      spin: i % 3 === 0,
    }));
  }, [dense]);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            position: 'absolute',
            left: it.left,
            top: it.top,
            width: it.size,
            height: it.size,
            opacity: 0.55,
            animation: `float-y ${it.dur}s ease-in-out ${it.delay}s infinite${it.spin ? `, spin-slow ${it.dur * 4}s linear infinite` : ''}`,
          }}
          dangerouslySetInnerHTML={{ __html: DECO[it.kind] }}
        />
      ))}
    </div>
  );
}

const DECO: Record<string, string> = {
  heart: `<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M16 27S3 19 3 11C3 7 6 4 10 4c2.5 0 4.7 1.4 6 3.5C17.3 5.4 19.5 4 22 4c4 0 7 3 7 7 0 8-13 16-13 16z" fill="#FFD6E0" stroke="#FF8FAB" stroke-width="1.5"/></svg>`,
  cloud: `<svg viewBox="0 0 40 28" width="100%" height="100%"><path d="M12 24C6 24 2 20 2 15s4-9 9-8c1-5 6-8 11-8 6 0 10 4 11 10 4 0 6 3 6 6s-3 7-7 7z" fill="#fff" stroke="#BDE0FE" stroke-width="1.5"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#FFE8A3" stroke="#FFC94D" stroke-width="1"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#BDE0FE" stroke="#6B4F4F" stroke-width="1"/></svg>`,
  bow: `<svg viewBox="0 0 32 24" width="100%" height="100%"><path d="M16 12 5 5C3 4 1 5 1 8v8c0 3 2 4 4 3l11-7zM16 12l11-7c2-1 4 0 4 3v8c0 3-2 4-4 3z" fill="#FF8FAB" stroke="#6B4F4F" stroke-width="1.2"/><circle cx="16" cy="12" r="3" fill="#FFD6E0"/></svg>`,
};
