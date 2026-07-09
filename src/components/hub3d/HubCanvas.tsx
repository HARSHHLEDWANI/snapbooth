'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { ThemeTokens } from '@/lib/daynight';
import { StreetScene, type StreetDest } from './StreetScene';

/** R3F canvas hosting the hub street. Transparent so the CSS sky shows. */
export function HubCanvas({ theme, reduced, onBegin, onOpen }: {
  theme: ThemeTokens;
  reduced: boolean;
  onBegin: (dest: StreetDest) => void;
  onOpen: (dest: StreetDest) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.1, 8.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        <StreetScene theme={theme} reduced={reduced} onBegin={onBegin} onOpen={onOpen} />
      </Suspense>
    </Canvas>
  );
}
