'use client';
import { useState } from 'react';
import { APP_NAME } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { emailStrip, emailSizedDataUrl, isValidEmail } from '@/lib/export/deliver';
import { toast } from '@/components/ui/toast';

export function EmailModal({ getCanvas, onClose }: { getCanvas: () => Promise<HTMLCanvasElement>; onClose: () => void }) {
  const userName = useBoothStore((s) => s.userName);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!isValidEmail(email)) { toast('that email looks off ♡', 'err'); return; }
    setSending(true);
    try {
      const canvas = await getCanvas();
      const dataUrl = await emailSizedDataUrl(canvas, 800);
      const res = await emailStrip(email.trim(), dataUrl, userName || 'a friend');
      toast(res.message, res.ok ? 'ok' : 'err');
      if (res.ok) onClose();
    } catch {
      toast('could not send right now', 'err');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="em-overlay" onClick={onClose}>
      <div className="em card grain" onClick={(e) => e.stopPropagation()}>
        <span className="label-spaced">e m a i l&nbsp;&nbsp;m y&nbsp;&nbsp;s t r i p</span>
        <h3>send it to your inbox 💌</h3>
        <p>we’ll email a copy of your {APP_NAME} strip.</p>
        <input autoFocus type="email" value={email} placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <div className="em-actions">
          <button className="btn btn-ghost" onClick={onClose}>cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={sending}>{sending ? 'sending…' : 'send ♡'}</button>
        </div>
      </div>
      <style jsx>{`
        .em-overlay { position: absolute; inset: 0; z-index: 80; display: grid; place-items: center; background: rgba(107,79,79,0.35); backdrop-filter: blur(4px); padding: 16px; }
        .em { position: relative; width: min(380px, 94%); padding: 24px; display: flex; flex-direction: column; gap: 8px; text-align: center; }
        .em h3 { font-size: 1.3rem; }
        .em input { padding: 12px; border: 2.5px dashed var(--pink); border-radius: 14px; background: var(--cream); color: var(--brown); text-align: center; }
        .em-actions { display: flex; gap: 10px; justify-content: center; margin-top: 6px; }
      `}</style>
    </div>
  );
}
