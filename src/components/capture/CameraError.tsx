'use client';
import type { CameraStatus } from '@/lib/capture/useCamera';

/** Cute illustrated error state for camera permission denial / failure. */
export function CameraError({
  status,
  message,
  onRetry,
}: {
  status: CameraStatus;
  message: string | null;
  onRetry: () => void;
}) {
  const denied = status === 'denied';
  return (
    <div className="cam-err">
      <div className="cam-art" aria-hidden>
        <svg viewBox="0 0 120 100" width="130">
          <rect x="18" y="30" width="84" height="56" rx="12" fill="#FFD6E0" stroke="#6B4F4F" strokeWidth="3" />
          <path d="M44 30l7-10h18l7 10" fill="#FFD6E0" stroke="#6B4F4F" strokeWidth="3" />
          <circle cx="60" cy="58" r="17" fill="#fff" stroke="#6B4F4F" strokeWidth="3" />
          <circle cx="54" cy="55" r="2.5" fill="#6B4F4F" />
          <circle cx="66" cy="55" r="2.5" fill="#6B4F4F" />
          <path d="M53 66c4-4 10-4 14 0" fill="none" stroke="#6B4F4F" strokeWidth="2.5" strokeLinecap="round" transform="rotate(180 60 64)" />
          <path d="M14 14l92 78" stroke="#FF6B93" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <h3>{denied ? 'camera is shy!' : 'hmm, no camera'}</h3>
      <p>
        {denied
          ? 'i need camera access to take your photos. tap the 🔒 / camera icon in your address bar, allow the camera, then hit retry.'
          : message || 'i couldn’t reach a camera on this device.'}
      </p>
      <button className="btn btn-primary" onClick={onRetry}>try again ♡</button>
      <style jsx>{`
        .cam-err {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; text-align: center;
          padding: 20px; background: var(--cream); color: var(--brown);
        }
        .cam-art { animation: float-y 4s ease-in-out infinite; }
        .cam-err h3 { font-size: 1.4rem; }
        .cam-err p { max-width: 320px; font-size: 0.9rem; line-height: 1.4; }
      `}</style>
    </div>
  );
}
