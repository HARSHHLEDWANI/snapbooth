'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { BoothExterior } from './BoothExterior';

/** R3F canvas hosting the exterior scene. Transparent so the CSS sky shows. */
export function Booth3D({
  onEntered,
  onEnterClick,
  lowPower,
}: {
  onEntered: () => void;
  onEnterClick: () => void;
  lowPower: boolean;
}) {
  return (
    <Canvas
      shadows={!lowPower}
      dpr={lowPower ? [1, 1.2] : [1, 2]}
      camera={{ position: [0.2, 2.0, 9.2], fov: 40 }}
      gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        <BoothExterior onEntered={onEntered} onEnterClick={onEnterClick} />
      </Suspense>
    </Canvas>
  );
}
