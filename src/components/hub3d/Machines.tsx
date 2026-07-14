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

/** "we decide" — a signpost kiosk whose two arrows can't agree */
export function DecideKiosk({ glow }: { glow: number }) {
  const heart = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (heart.current) heart.current.position.y = 3.35 + Math.sin(state.clock.elapsedTime * 1.6) * 0.08;
  });
  return (
    <group>
      {/* ballot-box body with a coin slot */}
      <RoundedBox args={[1.6, 1.5, 1.3]} radius={0.12} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={BUTTER} roughness={0.65} />
      </RoundedBox>
      <mesh position={[0, 1.52, 0]}>
        <boxGeometry args={[0.7, 0.06, 0.16]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      {/* the post */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 1.6, 10]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      {/* two arrows pointing opposite ways */}
      <group position={[0, 2.55, 0]} rotation={[0, 0, 0.06]}>
        <RoundedBox args={[1.5, 0.4, 0.12]} radius={0.08} castShadow>
          <meshStandardMaterial color={PINK} roughness={0.55} />
        </RoundedBox>
        <mesh position={[-0.85, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.3, 0.3, 0.12]} />
          <meshStandardMaterial color={PINK} roughness={0.55} />
        </mesh>
        <Text position={[0, 0, 0.09]} fontSize={0.18} anchorX="center" anchorY="middle" color={CREAM}>this way</Text>
      </group>
      <group position={[0, 3.0, 0]} rotation={[0, 0, -0.06]}>
        <RoundedBox args={[1.5, 0.4, 0.12]} radius={0.08} castShadow>
          <meshStandardMaterial color={SKY} roughness={0.55} />
        </RoundedBox>
        <mesh position={[0.85, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.3, 0.3, 0.12]} />
          <meshStandardMaterial color={SKY} roughness={0.55} />
        </mesh>
        <Text position={[0, 0, 0.09]} fontSize={0.18} anchorX="center" anchorY="middle" color={BROWN}>no, this way</Text>
      </group>
      {/* the reconciling heart */}
      <mesh ref={heart} position={[0, 3.35, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={glow * 0.8} />
      </mesh>
    </group>
  );
}

/** "who'd pick this?" — a tiny street gallery wall of polaroids */
export function PickGallery({ glow }: { glow: number }) {
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (bulb.current) bulb.current.emissiveIntensity = glow * (0.8 + Math.sin(state.clock.elapsedTime * 2.2) * 0.3);
  });
  const frames: [number, number, string][] = [
    [-0.62, 1.95, BLUSH], [0.62, 1.95, SKY], [-0.62, 1.05, BUTTER], [0.62, 1.05, '#c8f0dc'],
  ];
  return (
    <group>
      {/* gallery wall */}
      <RoundedBox args={[2.4, 2.6, 0.3]} radius={0.1} position={[0, 1.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CREAM} roughness={0.8} />
      </RoundedBox>
      {/* four polaroids */}
      {frames.map(([x, y, c], i) => (
        <group key={i} position={[x, y, 0.18]} rotation={[0, 0, (i % 2 ? -1 : 1) * 0.05]}>
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.72, 0.03]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.06, 0.02]}>
            <planeGeometry args={[0.64, 0.46]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow * 0.35} />
          </mesh>
        </group>
      ))}
      {/* glowing question mark */}
      <Text position={[0, 3.15, 0.1]} fontSize={0.5} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor={BROWN}>
        ?
        <meshStandardMaterial ref={bulb} color={PINK} emissive={PINK} emissiveIntensity={glow} toneMapped={false} />
      </Text>
      {/* little bench in front */}
      <mesh position={[0, 0.28, 1]} castShadow>
        <boxGeometry args={[1.3, 0.1, 0.4]} />
        <meshStandardMaterial color={BROWN} roughness={0.9} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.12, 1]}>
          <boxGeometry args={[0.08, 0.24, 0.34]} />
          <meshStandardMaterial color={BROWN} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** the hangout — a cozy corner café with steam curling off a giant cup */
export function HangoutCafe({ glow }: { glow: number }) {
  const steam = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (steam.current) {
      steam.current.position.y = 3.45 + ((t * 0.35) % 0.5);
      (steam.current.material as THREE.MeshStandardMaterial).opacity = 0.55 - ((t * 0.35) % 0.5);
    }
  });
  return (
    <group>
      {/* café body */}
      <RoundedBox args={[2.6, 2.4, 2]} radius={0.14} position={[0, 1.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c8f0dc" roughness={0.7} />
      </RoundedBox>
      {/* warm window */}
      <mesh position={[-0.45, 1.35, 1.02]}>
        <planeGeometry args={[1.0, 0.8]} />
        <meshStandardMaterial color={BUTTER} emissive={BUTTER} emissiveIntensity={glow * 0.8} />
      </mesh>
      {/* door */}
      <mesh position={[0.75, 0.85, 1.02]}>
        <planeGeometry args={[0.6, 1.3]} />
        <meshStandardMaterial color={BROWN} roughness={0.8} />
      </mesh>
      {/* striped awning */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.5, 2.28, 1.16]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[0.48, 0.4, 0.04]} />
          <meshStandardMaterial color={i % 2 ? '#7ed0a8' : CREAM} />
        </mesh>
      ))}
      {/* roof + giant coffee cup */}
      <RoundedBox args={[2.9, 0.3, 2.3]} radius={0.08} position={[0, 2.55, 0]} castShadow>
        <meshStandardMaterial color={CREAM} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 3.05, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.26, 0.6, 16]} />
        <meshStandardMaterial color={PINK} roughness={0.5} />
      </mesh>
      <mesh position={[0.42, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.045, 8, 14]} />
        <meshStandardMaterial color={PINK} roughness={0.5} />
      </mesh>
      <mesh ref={steam} position={[0, 3.45, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      {/* tiny table + two chairs out front */}
      <mesh position={[-1, 0.45, 1.5]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 14]} />
        <meshStandardMaterial color={CREAM} />
      </mesh>
      <mesh position={[-1, 0.22, 1.5]}>
        <cylinderGeometry args={[0.05, 0.07, 0.42, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      {[-1.45, -0.55].map((x) => (
        <mesh key={x} position={[x, 0.22, 1.5]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.42, 10]} />
          <meshStandardMaterial color={x < -1 ? PINK : SKY} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** "tied together" — the little park: two blobs joined by a ribbon */
export function RopePark({ glow }: { glow: number }) {
  const blobA = useRef<THREE.Mesh>(null);
  const blobB = useRef<THREE.Mesh>(null);
  const ribbon = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // the blobs bounce in counterphase and the ribbon rides their rhythm
    if (blobA.current) blobA.current.position.y = 0.62 + Math.abs(Math.sin(t * 1.8)) * 0.22;
    if (blobB.current) blobB.current.position.y = 0.62 + Math.abs(Math.sin(t * 1.8 + Math.PI / 2)) * 0.22;
    if (ribbon.current) ribbon.current.position.y = 0.72 + (Math.abs(Math.sin(t * 1.8)) + Math.abs(Math.sin(t * 1.8 + Math.PI / 2))) * 0.09;
  });
  return (
    <group>
      {/* grassy mound */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.9, 2.1, 0.24, 20]} />
        <meshStandardMaterial color="#a8dfc0" roughness={1} />
      </mesh>
      {/* tree */}
      <mesh position={[-1.2, 0.8, -0.5]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 1.2, 8]} />
        <meshStandardMaterial color={BROWN} />
      </mesh>
      {([[-1.2, 1.65, -0.5, 0.5], [-1.45, 1.4, -0.45, 0.34], [-0.95, 1.42, -0.55, 0.36]] as const).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 12, 12]} />
          <meshStandardMaterial color="#8fd6ac" roughness={1} />
        </mesh>
      ))}
      {/* the two blobs */}
      <mesh ref={blobA} position={[-0.6, 0.62, 0.3]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={PINK} roughness={0.55} />
      </mesh>
      <mesh ref={blobB} position={[0.6, 0.62, 0.3]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#7fb5f0" roughness={0.55} />
      </mesh>
      {/* ribbon between them, with a bow */}
      <mesh ref={ribbon} position={[0, 0.72, 0.3]}>
        <boxGeometry args={[1.1, 0.055, 0.055]} />
        <meshStandardMaterial color={BUTTER} emissive={BUTTER} emissiveIntensity={glow * 0.4} />
      </mesh>
      {([[-0.12, 0.35], [0.12, -0.35]] as const).map(([x, r], i) => (
        <mesh key={i} position={[x, 0.85, 0.3]} rotation={[0, 0, r + Math.PI / 2]}>
          <coneGeometry args={[0.09, 0.2, 8]} />
          <meshStandardMaterial color={BUTTER} />
        </mesh>
      ))}
      {/* park arch sign */}
      <group position={[1.35, 0, -0.4]}>
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2, 8]} />
          <meshStandardMaterial color={BROWN} />
        </mesh>
        <Text position={[0, 2.15, 0]} fontSize={0.24} anchorX="center" anchorY="middle" color={BROWN} outlineWidth={0.02} outlineColor={CREAM}>
          🎀
        </Text>
      </group>
    </group>
  );
}
