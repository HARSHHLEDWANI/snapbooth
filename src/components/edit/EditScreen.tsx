'use client';

import { useEffect, useRef, useState } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { STRIP_EXPORT_WIDTH } from '@/config/app';
import { canvasToBlob, downloadBlob, shareImage, stampName } from '@/lib/export/deliver';
import { play } from '@/lib/sound/sound';
import { toast } from '@/components/ui/toast';
import { TopBar } from '@/components/ui/TopBar';
import { Decorations } from '@/components/ui/Decorations';
import { StripPreview, type StripPreviewHandle } from './StripPreview';
import { EditPanel } from './EditPanel';
import { EmailModal } from './EmailModal';
import { useDuoEditSync } from '@/lib/duo/useDuoEditSync';
import { getActiveRoom } from '@/lib/duo/room';

export function EditScreen() {
  // duo: mirror edit state between the two peers (no-op solo)
  useDuoEditSync();
  const duo = useBoothStore((s) => s.duo);
  const shots = useBoothStore((s) => s.shots);
  const reset = useBoothStore((s) => s.reset);
  const setPhase = useBoothStore((s) => s.setPhase);
  const undo = useBoothStore((s) => s.undo);
  const redo = useBoothStore((s) => s.redo);
  const canUndo = useBoothStore((s) => s.past.length > 0);
  const canRedo = useBoothStore((s) => s.future.length > 0);
  const saveRecentStrip = useBoothStore((s) => s.saveRecentStrip);
  const previewRef = useRef<StripPreviewHandle>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // save a thumbnail to "my strips" once the edit screen opens
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current || !shots.length) return;
    savedRef.current = true;
    const t = setTimeout(async () => {
      try {
        const canvas = await previewRef.current!.exportCanvas(0.5);
        const thumb = document.createElement('canvas');
        thumb.width = 120;
        thumb.height = (canvas.height / canvas.width) * 120;
        thumb.getContext('2d')!.drawImage(canvas, 0, 0, thumb.width, thumb.height);
        saveRecentStrip(thumb.toDataURL('image/jpeg', 0.7));
      } catch {}
    }, 900);
    return () => clearTimeout(t);
  }, [shots.length, saveRecentStrip]);

  const exportFull = () => previewRef.current!.exportCanvas(2);

  const onDownload = async () => {
    setBusy(true);
    try {
      const canvas = await exportFull();
      const blob = await canvasToBlob(canvas, 'image/png');
      downloadBlob(blob, stampName('png'));
      play('success');
      toast('saved to your device! ♡', 'ok');
    } finally { setBusy(false); }
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const canvas = await exportFull();
      const blob = await canvasToBlob(canvas, 'image/png');
      const ok = await shareImage(blob, stampName('png'));
      if (!ok) { downloadBlob(blob, stampName('png')); toast('sharing not supported — downloaded instead', 'info'); }
    } finally { setBusy(false); }
  };

  // keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="edit-screen">
      <TopBar />
      <Decorations />
      {duo.active && (
        <div className="duo-edit-chip">
          <span className={`dot ${duo.connected ? 'on' : ''}`} />
          {duo.connected ? `editing with ${duo.partnerName ?? 'your friend'} 💞` : 'friend left — editing solo'}
        </div>
      )}
      <div className="edit-body">
        <div className="preview-col">
          <div className="undo-row">
            <button
              className="btn btn-ghost mini"
              onClick={() => {
                if (duo.connected) getActiveRoom()?.send({ t: 'retake' });
                setPhase('capture');
              }}
            >← retake</button>
            <div className="ur-right">
              <button className="icon-btn" onClick={undo} disabled={!canUndo} title="undo">↶</button>
              <button className="icon-btn" onClick={redo} disabled={!canRedo} title="redo">↷</button>
            </div>
          </div>
          <div className="preview-stage">
            <StripPreview ref={previewRef} />
          </div>
        </div>

        <div className="panel-col">
          <EditPanel />
          <div className="export-bar">
            <button className="btn btn-ghost" onClick={onShare} disabled={busy}>↗ share</button>
            <button className="btn btn-ghost" onClick={() => setEmailOpen(true)} disabled={busy}>💌 email</button>
            <button className="btn btn-primary" onClick={onDownload} disabled={busy}>{busy ? '…' : '⬇ download'}</button>
          </div>
        </div>
      </div>

      <button
        className="new-strip btn btn-ghost"
        onClick={() => {
          play('pop');
          getActiveRoom()?.destroy();
          useBoothStore.getState().resetDuo();
          reset();
        }}
      >＋ new strip</button>

      {emailOpen && <EmailModal getCanvas={exportFull} onClose={() => setEmailOpen(false)} />}

      <style jsx>{`
        .edit-screen { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(180deg, #ffeef4, var(--cream)); }
        .duo-edit-chip { position: absolute; z-index: 21; top: 56px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.9); border: 2.5px solid var(--brown); border-radius: 999px; padding: 5px 14px; font-weight: 800; font-size: 0.8rem; color: var(--brown); box-shadow: var(--shadow-sm); }
        .duo-edit-chip .dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; }
        .duo-edit-chip .dot.on { background: #6fcf7c; box-shadow: 0 0 6px #6fcf7c; }
        .edit-body { position: absolute; inset: 0; z-index: 2; display: grid; grid-template-columns: 1fr 380px; gap: 16px; padding: 60px 20px 20px; }
        @media (max-width: 860px) {
          .edit-body { grid-template-columns: 1fr; grid-template-rows: 1fr auto; padding: 56px 10px 10px; gap: 8px; overflow-y: auto; }
        }
        .preview-col { display: flex; flex-direction: column; min-height: 0; }
        .undo-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .ur-right { display: flex; gap: 6px; }
        .icon-btn { width: 38px; height: 38px; border-radius: 50%; border: 2.5px solid var(--brown); background: var(--white); font-size: 1.2rem; color: var(--brown); box-shadow: var(--shadow-sm); }
        .icon-btn:disabled { opacity: 0.4; }
        .preview-stage { flex: 1; display: grid; place-items: center; min-height: 0; overflow: auto; padding: 4px; }
        .panel-col { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
        @media (max-width: 860px) { .panel-col { max-height: 46vh; } }
        .export-bar { display: flex; gap: 8px; justify-content: stretch; }
        .export-bar :global(.btn) { flex: 1; padding: 0.7em 0.6em; }
        .new-strip { position: absolute; z-index: 3; left: 20px; bottom: 16px; }
        @media (max-width: 860px) { .new-strip { display: none; } }
        .mini { font-size: 0.82rem; padding: 0.45em 1em; }
      `}</style>
    </div>
  );
}
