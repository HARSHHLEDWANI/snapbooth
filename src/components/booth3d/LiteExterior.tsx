'use client';
import { APP_NAME } from '@/config/app';

/** 2D illustrated booth — the lite-mode / no-WebGL fallback for the exterior. */
export function LiteExterior({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <button className="lite-booth" onClick={onEnterClick} aria-label="enter the booth">
      <svg viewBox="0 0 260 320" width="min(70vw, 300px)">
        <ellipse cx="130" cy="300" rx="95" ry="16" fill="#6b4f4f" opacity="0.18" />
        {/* legs */}
        <rect x="72" y="252" width="16" height="46" rx="7" fill="#6b4f4f" />
        <rect x="172" y="252" width="16" height="46" rx="7" fill="#6b4f4f" />
        {/* body */}
        <rect x="40" y="70" width="180" height="196" rx="22" fill="#ff8fab" stroke="#6b4f4f" strokeWidth="4" />
        {/* awning */}
        <g>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={40 + i * 22.5} y="60" width="22.5" height="26" fill={i % 2 ? '#fff8f0' : '#ff8fab'} stroke="#6b4f4f" strokeWidth="2" />
          ))}
        </g>
        <rect x="34" y="44" width="192" height="20" rx="8" fill="#ffe8a3" stroke="#6b4f4f" strokeWidth="4" />
        {/* sign */}
        <rect x="70" y="12" width="120" height="34" rx="16" fill="#fff8f0" stroke="#6b4f4f" strokeWidth="4" />
        <text x="130" y="35" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="19" fill="#ff8fab">{APP_NAME}</text>
        {/* screen */}
        <rect x="70" y="104" width="120" height="90" rx="12" fill="#2b2320" />
        <rect x="78" y="112" width="104" height="74" rx="8" fill="#ffd6e0" />
        <circle cx="130" cy="149" r="10" fill="#fff8f0" stroke="#6b4f4f" strokeWidth="3" />
        {/* curtain */}
        <rect x="70" y="200" width="120" height="46" rx="8" fill="#ff9fb6" stroke="#6b4f4f" strokeWidth="3" />
        <path d="M70 200 q15 26 30 0 q15 26 30 0 q15 26 30 0 q15 26 30 0" fill="none" stroke="#6b4f4f" strokeWidth="2" />
        {/* arrow */}
        <g transform="translate(224 150)">
          <circle r="26" fill="#ffe8a3" stroke="#6b4f4f" strokeWidth="3" />
          <text y="-2" textAnchor="middle" fontSize="9" fontWeight="700" fill="#6b4f4f">photos</text>
          <text y="9" textAnchor="middle" fontSize="9" fontWeight="700" fill="#6b4f4f">here!</text>
        </g>
      </svg>
      <style jsx>{`
        .lite-booth { background: none; border: none; padding: 0; display: grid; place-items: center; animation: float-y 5s ease-in-out infinite; }
        .lite-booth:active { transform: scale(0.98); }
      `}</style>
    </button>
  );
}
