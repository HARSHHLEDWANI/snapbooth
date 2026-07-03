'use client';

import { useEffect, useState } from 'react';

type Toast = { id: number; msg: string; tone: 'ok' | 'err' | 'info' };
let counter = 0;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l(toasts));
}

export function toast(msg: string, tone: Toast['tone'] = 'info') {
  const t: Toast = { id: ++counter, msg, tone };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 2600);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className="toast"
          style={{
            background:
              t.tone === 'ok' ? 'var(--pink)' : t.tone === 'err' ? '#c0526b' : 'var(--brown)',
          }}
        >
          {t.tone === 'ok' ? '✓ ' : t.tone === 'err' ? '✕ ' : ''}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
