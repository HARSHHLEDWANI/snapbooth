'use client';
import { useState } from 'react';
import { APP_NAME } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { play } from '@/lib/sound/sound';

/** Soft "login": ask the visitor's name once (stored in localStorage). */
export function NamePrompt() {
  const setUserName = useBoothStore((s) => s.setUserName);
  const markNameAsked = useBoothStore((s) => s.markNameAsked);
  const [val, setVal] = useState('');

  const submit = () => {
    play('pop');
    if (val.trim()) setUserName(val.trim().slice(0, 20));
    else markNameAsked();
  };

  return (
    <div className="np-overlay">
      <div className="np card grain">
        <div className="np-art" aria-hidden>📸✨</div>
        <span className="label-spaced">w e l c o m e&nbsp;&nbsp;t o</span>
        <h2>{APP_NAME}</h2>
        <p>hi hi! what should i call you?</p>
        <input
          autoFocus
          value={val}
          maxLength={20}
          placeholder="your name ♡"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className="np-actions">
          <button className="btn btn-ghost" onClick={() => (play('pop'), markNameAsked())}>skip</button>
          <button className="btn btn-primary" onClick={submit}>let’s go →</button>
        </div>
      </div>
      <style jsx>{`
        .np-overlay { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(107,79,79,0.3); backdrop-filter: blur(4px); padding: 16px; }
        .np { position: relative; width: min(380px, 94%); padding: 26px 22px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
        .np-art { font-size: 2.4rem; }
        .np h2 { font-size: 2rem; color: var(--pink); }
        .np input { width: 100%; text-align: center; font-size: 1.1rem; padding: 12px; border: 2.5px dashed var(--pink); border-radius: 16px; background: var(--cream); color: var(--brown); margin-top: 6px; }
        .np-actions { display: flex; gap: 10px; margin-top: 8px; }
      `}</style>
    </div>
  );
}
