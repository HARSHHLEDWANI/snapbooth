'use client';

/**
 * Machines.tsx — the five little buildings of the hub street, all built from
 * R3F primitives (no GLB downloads). Each is a dumb visual component; hover,
 * labels and click-dolly live in StreetScene's <Machine> wrapper.
 * `glow` scales emissive intensity so screens/neon come alive at night.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

const PINK = '#ff8fab';
const BLUSH = '#ffd6e0';
const BUTTER = '#ffe8a3';
const CREAM = '#fff8f0';
const BROWN = '#6b4f4f';
const SKY = '#bde0fe';

/** hero: the photobooth machine */
export function BoothMachine({ glow, appName }: { glow: number; appName: string }) {
  const sign = useRef<THREE.MeshStandardMaterial>(null);
  const curtainL = useRef<THREE.Mesh>(null);
  const curtainR = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (curtainL.current) curtainL.current.rotation.z = Math.sin(t * 0.9) * 0.03;
    if (curtainR.current) curtainR.current.rotation.z = -Math.sin(t * 0.9 + 1) * 0.03;
    if (sign.current) {
      // neon flicker
      sign.current.emissiveIntensity = glow * (Math.random() > 0.985 ? 0.35 : 1) + Math.sin(t * 2) * 0.05;
    }
  });

  return (
    <group>
      <RoundedBox args={[2.6, 3.2, 2.1]} radius={0.16} smoothness={4} position={[0, 1.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PINK} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[2, 2.3, 0.1]} radius={0.1} position={[0, 1.42, 1.02]}>
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 1.8, 1.1]}>
        <planeGeometry args={[1.2, 0.85]} />
        <meshStandardMaterial color={BLUSH} emissive={BLUSH} emissiveIntensity={glow * 0.6} />
      </mesh>
      {/* curtains */}
      <mesh ref={curtainL} position={[-0.62, 0.95, 1.04]} castShadow>
        <boxGeometry args={[0.62, 1.9, 0.07]} />
        <meshStandardMaterial color="#ff9fb6" roughness={0.7} />
      </mesh>
      <mesh ref={curtainR} position={[0.62, 0.95, 1.04]} castShadow>
        <boxGeometry args={[0.62, 1.9, 0.07]} />
        <meshStandardMaterial color="#ff9fb6" roughness={0.7} />
      </mesh>
      {/* roof + awning stripes */}
      <RoundedBox args={[2.9, 0.35, 2.4]} radius={0.09} position={[0, 3.05, 0]} castShadow>
        <meshStandardMaterial color={BUTTER} roughness={0.6} />
      </RoundedBox>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-1.13 + i * 0.45, 2.82, 1.22]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.42, 0.32, 0.04]} />
          <meshStandardMaterial color={i % 2 ? PINK : CREAM} />
        </mesh>
      ))}
      {/* neon sign */}
      <Text position={[0, 3.55, 0.5]} fontSize={0.44} anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor={BROWN}>
        {appName}
        <meshStandardMaterial ref={sign} color={PINK} emissive={PINK} emissiveIntensity={glow} toneMapped={false} />
      </Text>
      {/* legs */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, -0.1, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.5, 10]} />
          <meshStandardMaterial color={BROWN} />
        </mesh>
      ))}
    </group>
  );
}

/** arcade cabinet with a pulsing screen */
export function ArcadeCabinet({ glow }: { glow: number }) {
  const screen = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (screen.current) {
      const mat = screen.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = glow * (0.7 + Math.sin(state.clock.elapsedTime * 3) * 0.25);
    }
  });
  return (
    <group>
      <RoundedBox args={[1.7, 3, 1.4]} radius={0.12} position={[0, 1.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={SKY} roughness={0.6} />
      </RoundedBox>
      {/* marquee */}
      <RoundedBox args={[1.8, 0.5, 1.5]} radius={0.1} position={[0, 3.1, 0]}>
        <meshStandardMaterial color={PINK} roughness={0.5} />
      </RoundedBox>
      <Text position={[0, 3.1, 0.79]} fontSize={0.24} anchorX="center" anchorY="middle" color={CREAM}>
        ★ arcade ★
      </Text>
      {/* screen, tilted like a real cab */}
      <mesh ref={screen} position={[0, 1.95, 0.66]} rotation={[-0.22, 0, 0]}>
        <planeGeometry args={[1.25, 0.95]} />
        <meshStandardMaterial color="#3a2f5c" emissive="#8fd0ff" emissiveIntensity={glow} />
      </mesh>
      {/* control deck + buttons */}
      <mesh position={[0, 1.28, 0.75]} rotation={[-1.1, 0, 0]}>
        <boxGeometry args={[1.5, 0.55, 0.08]} />
        <meshStandardMaterial color={CREAM} />
      </mesh>
      {[[-0.35, '#ff6b93'], [0.05, '#ffd23e'], [0.42, '#7ed0a8']].map(([x, c], i) => (
        <mesh key={i} position={[x as number, 1.42, 0.86]} rotation={[-1.1, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.09, 14]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      <mesh position={[-0.45, 1.52, 0.8]} rotation={[-1.1, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.3, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
    </group>
  );
}

/** quiz kiosk — a cute market stall with a big “?” sign */
export function QuizKiosk({ glow }: { glow: number }) {
  return (
    <group>
      {/* counter */}
      <RoundedBox args={[2.2, 1.15, 1.2]} radius={0.1} position={[0, 0.58, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={BUTTER} roughness={0.7} />
      </RoundedBox>
      {/* poles */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.1, 8]} />
          <meshStandardMaterial color={BROWN} />
        </mesh>
      ))}
      {/* scalloped roof */}
      <RoundedBox args={[2.5, 0.28, 1.5]} radius={0.08} position={[0, 2.8, 0]} castShadow>
        <meshStandardMaterial color={PINK} roughness={0.6} />
      </RoundedBox>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.5, 2.6, 0.76]}>
          <sphereGeometry args={[0.16, 10, 10, 0, Math.PI * 2, Math.PI / 2]} />
          <meshStandardMaterial color={i % 2 ? CREAM : PINK} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the "?" sign */}
      <mesh position={[0, 2, 0.3]}>
        <circleGeometry args={[0.5, 26]} />
        <meshStandardMaterial color={CREAM} emissive={BLUSH} emissiveIntensity={glow * 0.5} />
      </mesh>
      <Text position={[0, 2, 0.32]} fontSize={0.62} anchorX="center" anchorY="middle" color={PINK} outlineWidth={0.02} outlineColor={BROWN}>
        ?
      </Text>
      {/* card stack on the counter */}
      <RoundedBox args={[0.5, 0.08, 0.7]} radius={0.02} position={[0.55, 1.2, 0.15]} rotation={[0, 0.3, 0]}>
        <meshStandardMaterial color={CREAM} />
      </RoundedBox>
    </group>
  );
}

/** drawing easel under a little awning */
export function DrawingEasel({ glow }: { glow: number }) {
  return (
    <group>
      {/* easel legs */}
      <mesh position={[-0.35, 0.9, 0.1]} rotation={[0, 0, 0.18]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.9, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      <mesh position={[0.35, 0.9, 0.1]} rotation={[0, 0, -0.18]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.9, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      <mesh position={[0, 0.9, -0.3]} rotation={[-0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.9, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      {/* canvas with a half-drawn heart */}
      <mesh position={[0, 1.25, 0.16]} rotation={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[1.15, 1.35, 0.06]} />
        <meshStandardMaterial color="#ffffff" emissive={CREAM} emissiveIntensity={glow * 0.25} />
      </mesh>
      <Text position={[0, 1.28, 0.21]} rotation={[-0.08, 0, 0]} fontSize={0.5} anchorX="center" anchorY="middle" color={BLUSH}>
        ♡
      </Text>
      {/* paint tray */}
      <mesh position={[0, 0.62, 0.28]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[1.1, 0.07, 0.22]} />
        <meshStandardMaterial color={BUTTER} />
      </mesh>
      {/* awning on two poles */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, 1.5, 0.6]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 3, 8]} />
          <meshStandardMaterial color={CREAM} />
        </mesh>
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-0.9 + i * 0.45, 2.9, 0.72]} rotation={[0.45, 0, 0]}>
          <boxGeometry args={[0.44, 0.5, 0.04]} />
          <meshStandardMaterial color={i % 2 ? SKY : CREAM} />
        </mesh>
      ))}
    </group>
  );
}

/** tiny debate stage — two podiums and a banner */
export function DebateStage({ glow }: { glow: number }) {
  return (
    <group>
      {/* platform */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.8, 0.36, 22]} />
        <meshStandardMaterial color="#e8b6c8" roughness={0.7} />
      </mesh>
      {/* podiums */}
      {[-0.7, 0.7].map((x, i) => (
        <group key={x} position={[x, 0.36, 0.2]} rotation={[0, i === 0 ? 0.3 : -0.3, 0]}>
          <RoundedBox args={[0.55, 0.95, 0.45]} radius={0.06} position={[0, 0.48, 0]} castShadow>
            <meshStandardMaterial color={i === 0 ? PINK : SKY} roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 1, 0.05]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.4]} />
            <meshStandardMaterial color={BROWN} />
          </mesh>
        </group>
      ))}
      {/* banner between poles */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.6, -0.5]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
          <meshStandardMaterial color={BROWN} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, -0.5]}>
        <planeGeometry args={[2.9, 0.6]} />
        <meshStandardMaterial color={BUTTER} emissive={BUTTER} emissiveIntensity={glow * 0.4} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 2.6, -0.48]} fontSize={0.26} anchorX="center" anchorY="middle" color={BROWN}>
        debate club
      </Text>
      {/* a little crown on a cushion */}
      <mesh position={[0, 0.45, 0.85]}>
        <cylinderGeometry args={[0.22, 0.26, 0.12, 12]} />
        <meshStandardMaterial color={PINK} />
      </mesh>
      <mesh position={[0, 0.58, 0.85]}>
        <coneGeometry args={[0.16, 0.22, 5]} />
        <meshStandardMaterial color="#ffd23e" emissive="#ffd23e" emissiveIntensity={glow * 0.5} />
      </mesh>
    </group>
  );
}
