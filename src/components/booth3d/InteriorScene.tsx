'use client';

/**
 * InteriorScene — the INSIDE of the booth, in real 3D.
 * The mirror screen is a plane textured with the live shader-filtered preview
 * canvas (updated every frame). You can drag to peek around and scroll to lean
 * in/out — OrbitControls with cosy limits so you never leave the booth.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';

const PINK = '#ff8fab';
const BLUSH = '#ffd6e0';
const BUTTER = '#ffe8a3';
const CREAM = '#fff8f0';
const BROWN = '#6b4f4f';
const SKY = '#bde0fe';

function Screen({ source }: { source: HTMLCanvasElement }) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(source);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [source]);

  useFrame(() => { tex.needsUpdate = true; });

  return (
    <group position={[0, 1.62, -1.18]}>
      {/* chunky bezel */}
      <RoundedBox args={[3.45, 2.1, 0.16]} radius={0.09} smoothness={3}>
        <meshStandardMaterial color={BROWN} roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[3.3, 1.95, 0.05]} radius={0.07} position={[0, 0, 0.07]}>
        <meshStandardMaterial color={'#fff'} roughness={0.8} />
      </RoundedBox>
      {/* the live mirror */}
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[3.14, 1.77]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* soft glow spill from the screen */}
      <pointLight position={[0, 0, 0.8]} intensity={1.1} color={BLUSH} distance={4} />
    </group>
  );
}

function FairyLights() {
  const pts = useMemo(() => {
    const arr: { x: number; y: number; z: number; c: string }[] = [];
    const colors = [PINK, BUTTER, SKY, '#fff'];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = -2.3 + t * 4.6;
      const y = 3.0 - Math.sin(t * Math.PI) * 0.35;
      arr.push({ x, y, z: -1.15, c: colors[i % 4] });
    }
    return arr;
  }, []);
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={p.c} emissive={p.c} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Curtains() {
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (l.current) l.current.rotation.y = 0.12 + Math.sin(t * 0.7) * 0.035;
    if (r.current) r.current.rotation.y = -0.12 - Math.sin(t * 0.7 + 1.3) * 0.035;
  });
  // pleated look via repeated thin boxes merged in a group would cost draw calls;
  // a single wavy-striped material box reads well enough at this scale.
  return (
    <>
      <mesh ref={l} position={[-2.55, 1.55, 0.4]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.22, 3.4, 1.9]} />
        <meshStandardMaterial color={'#ff9fb6'} roughness={0.85} />
      </mesh>
      <mesh ref={r} position={[2.55, 1.55, 0.4]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[0.22, 3.4, 1.9]} />
        <meshStandardMaterial color={'#ff9fb6'} roughness={0.85} />
      </mesh>
    </>
  );
}

function Booth({ screenSource, flashOn }: { screenSource: HTMLCanvasElement; flashOn: boolean }) {
  const flashRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (flashRef.current) {
      flashRef.current.intensity = THREE.MathUtils.lerp(flashRef.current.intensity, flashOn ? 18 : 0, 0.5);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#ffe3ea', '#fff3d9', 0.55]} />
      <directionalLight position={[1.5, 4, 3]} intensity={0.75} />
      <pointLight ref={flashRef} position={[0, 2, 1.5]} intensity={0} color={'#fff'} distance={8} />

      {/* room shell */}
      <mesh position={[0, 1.6, -1.4]}>
        <planeGeometry args={[6.4, 4.4]} />
        <meshStandardMaterial color={BLUSH} roughness={1} />
      </mesh>
      {/* wall paneling stripes */}
      {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
        <mesh key={x} position={[x, 1.6, -1.39]}>
          <planeGeometry args={[0.5, 4.4]} />
          <meshStandardMaterial color={'#ffc9d6'} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, -0.1, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.4, 5]} />
        <meshStandardMaterial color={'#e8b7c2'} roughness={1} />
      </mesh>
      <mesh position={[0, 3.4, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.4, 5]} />
        <meshStandardMaterial color={CREAM} roughness={1} />
      </mesh>
      {/* side walls */}
      <mesh position={[-3.1, 1.6, 0.6]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5, 4.4]} />
        <meshStandardMaterial color={'#ffc9d6'} roughness={1} />
      </mesh>
      <mesh position={[3.1, 1.6, 0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[5, 4.4]} />
        <meshStandardMaterial color={'#ffc9d6'} roughness={1} />
      </mesh>

      <Screen source={screenSource} />
      <FairyLights />
      <Curtains />

      {/* shelf under the screen with a decorative arcade button + camera */}
      <RoundedBox args={[3.6, 0.14, 0.55]} radius={0.05} position={[0, 0.45, -0.95]}>
        <meshStandardMaterial color={BROWN} roughness={0.6} />
      </RoundedBox>
      <group position={[0.95, 0.56, -0.9]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.16, 0.08, 20]} />
          <meshStandardMaterial color={'#fff'} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={'#e23e63'} roughness={0.35} />
        </mesh>
      </group>
      <Float speed={2.4} floatIntensity={0.25} rotationIntensity={0.1}>
        <group position={[-1.1, 0.68, -0.9]} rotation={[0, 0.4, 0]}>
          <RoundedBox args={[0.36, 0.26, 0.18]} radius={0.04}>
            <meshStandardMaterial color={SKY} />
          </RoundedBox>
          <mesh position={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
            <meshStandardMaterial color={BROWN} />
          </mesh>
        </group>
      </Float>

      {/* "smile!" sign above the screen */}
      <Text position={[0, 2.95, -1.1]} fontSize={0.3} color={PINK} anchorX="center" outlineWidth={0.016} outlineColor={'#fff'}>
        smile! ♡
      </Text>

      <Sparkles count={24} scale={[5, 3, 3]} size={2.6} speed={0.25} color={'#fff'} position={[0, 1.8, 0]} />
    </group>
  );
}

export default function InteriorScene({
  screenSource,
  flashOn,
  lowPower,
}: {
  screenSource: HTMLCanvasElement;
  flashOn: boolean;
  lowPower: boolean;
}) {
  return (
    <Canvas
      dpr={lowPower ? [1, 1.2] : [1, 1.75]}
      camera={{ position: [0, 1.55, 2.6], fov: 50 }}
      gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#ffe3ea']} />
      <fog attach="fog" args={['#ffd6e0', 6, 12]} />
      <Booth screenSource={screenSource} flashOn={flashOn} />
      <OrbitControls
        target={[0, 1.55, -1.1]}
        enablePan={false}
        minDistance={1.4}
        maxDistance={3.6}
        minPolarAngle={Math.PI / 2 - 0.5}
        maxPolarAngle={Math.PI / 2 + 0.3}
        minAzimuthAngle={-0.55}
        maxAzimuthAngle={0.55}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.6}
        rotateSpeed={0.5}
      />
    </Canvas>
  );
}
