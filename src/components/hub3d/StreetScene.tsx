'use client';

/**
 * StreetScene.tsx — the dreamy little plaza. Five machines along a street on
 * the X axis; scroll / drag pans the camera, clicking a machine dollies into
 * it (GSAP) and opens that activity. One shadow light, cheap materials.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles, Text, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { APP_NAME } from '@/config/app';
import type { ThemeTokens } from '@/lib/daynight';
import { play } from '@/lib/sound/sound';
import { BoothMachine, ArcadeCabinet, QuizKiosk, DrawingEasel, DebateStage } from './Machines';

export type StreetDest = 'booth' | 'quiz' | 'draw' | 'debate' | 'arcade';

const PAN_MIN = -11.5;
const PAN_MAX = 11.5;

export const STREET_SPOTS: { dest: StreetDest; x: number; label: string }[] = [
  { dest: 'draw', x: -10.5, label: 'easel · draw together' },
  { dest: 'quiz', x: -5.5, label: 'quiz kiosk · how well do you know me?' },
  { dest: 'booth', x: 0, label: 'photobooth · for one or two' },
  { dest: 'arcade', x: 5.5, label: 'arcade · tiny synced games' },
  { dest: 'debate', x: 10.5, label: 'debate club · win the crown' },
];

function Machine({
  x, label, dest, children, onOpen, dollyLock,
}: {
  x: number; label: string; dest: StreetDest; children: ReactNode;
  onOpen: (d: StreetDest, x: number) => void;
  dollyLock: React.MutableRefObject<boolean>;
}) {
  const lift = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!lift.current) return;
    gsap.to(lift.current.position, { y: hover ? 0.14 : 0, duration: 0.4, ease: 'power2.out' });
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hover]);

  return (
    <group position={[x, 0, 0]}>
      <group
        ref={lift}
        onClick={(e) => { e.stopPropagation(); if (!dollyLock.current) onOpen(dest, x); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        {children}
      </group>
      {hover && (
        <Float speed={2.5} floatIntensity={0.5} rotationIntensity={0}>
          <group position={[0, 4.15, 0.4]}>
            <Text fontSize={0.3} anchorX="center" anchorY="middle" color="#6b4f4f" outlineWidth={0.05} outlineColor="#ffffff">
              {label}
            </Text>
          </group>
        </Float>
      )}
    </group>
  );
}

export function StreetScene({ theme, reduced, onBegin, onOpen }: {
  theme: ThemeTokens;
  reduced: boolean;
  /** fired the moment a dolly-in starts, so the HUD can fade */
  onBegin?: (dest: StreetDest) => void;
  onOpen: (dest: StreetDest) => void;
}) {
  const { camera, gl } = useThree();
  const pan = useRef(0);
  const dollying = useRef(false);
  const look = useRef(new THREE.Vector3(0, 1.35, 0));

  // wheel + drag panning on the canvas element
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (dollying.current) return;
      e.preventDefault();
      pan.current = THREE.MathUtils.clamp(pan.current + (e.deltaY + e.deltaX) * 0.012, PAN_MIN, PAN_MAX);
    };
    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    const onDown = (e: PointerEvent) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e: PointerEvent) => {
      if (!dragging || dollying.current) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      // horizontal drag on desktop, vertical drag on portrait phones — both work
      pan.current = THREE.MathUtils.clamp(pan.current - (dx + dy) * 0.02, PAN_MIN, PAN_MAX);
    };
    const onUp = () => { dragging = false; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl]);

  // keyboard panning (← →)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || dollying.current) return;
      if (e.code === 'ArrowRight') pan.current = Math.min(PAN_MAX, pan.current + 1.2);
      if (e.code === 'ArrowLeft') pan.current = Math.max(PAN_MIN, pan.current - 1.2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame((_, dt) => {
    if (dollying.current) return;
    const k = 1 - Math.exp(-dt * 5);
    camera.position.x += (pan.current * 0.92 - camera.position.x) * k;
    look.current.x += (pan.current * 0.85 - look.current.x) * k;
    camera.lookAt(look.current);
  });

  const openWithDolly = (dest: StreetDest, x: number) => {
    play('pop');
    if (reduced) { onBegin?.(dest); onOpen(dest); return; }
    dollying.current = true;
    onBegin?.(dest);
    play('whir');
    const tl = gsap.timeline({ onComplete: () => onOpen(dest) });
    tl.to(camera.position, {
      x: x * 0.97, y: 1.7, z: dest === 'booth' ? 2.6 : 3.9,
      duration: 1.2, ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(look.current),
    });
    tl.to(look.current, { x, y: 1.5, z: 0.4, duration: 1.2, ease: 'power2.inOut' }, '<');
  };

  return (
    <group>
      {/* lighting rig — exactly one shadow light */}
      <ambientLight intensity={theme.ambient} />
      <directionalLight
        position={theme.sun.position}
        color={theme.sun.color}
        intensity={theme.sun.intensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={25}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={8}
        shadow-camera-bottom={-4}
      />
      <hemisphereLight args={theme.hemi} />
      <fog attach="fog" args={[theme.fog, 10, 26]} />

      {/* ground + street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[46, 26]} />
        <meshStandardMaterial color={theme.ground} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.8]} receiveShadow>
        <planeGeometry args={[46, 2.6]} />
        <meshStandardMaterial color={theme.road} roughness={1} />
      </mesh>
      {/* dashed centre line */}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-14 + i * 1.9, 0.005, 2.8]}>
          <planeGeometry args={[0.8, 0.12]} />
          <meshStandardMaterial color="#fff8f0" roughness={1} />
        </mesh>
      ))}

      {/* the machines */}
      {STREET_SPOTS.map((s) => (
        <Machine key={s.dest} x={s.x} label={s.label} dest={s.dest} onOpen={openWithDolly} dollyLock={dollying}>
          {s.dest === 'booth' && <BoothMachine glow={theme.emissive} appName={APP_NAME} />}
          {s.dest === 'arcade' && <ArcadeCabinet glow={theme.emissive} />}
          {s.dest === 'quiz' && <QuizKiosk glow={theme.emissive} />}
          {s.dest === 'draw' && <DrawingEasel glow={theme.emissive} />}
          {s.dest === 'debate' && <DebateStage glow={theme.emissive} />}
        </Machine>
      ))}

      {/* street lamps between the machines */}
      {[-8, -2.75, 2.75, 8].map((x) => (
        <group key={x} position={[x, 0, 1.4]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.05, 0.07, 2.6, 8]} />
            <meshStandardMaterial color="#6b4f4f" />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#fff2c8" emissive="#ffe8a3" emissiveIntensity={theme.emissive * 1.3} />
          </mesh>
        </group>
      ))}

      {/* clouds */}
      {[[-9, 4.4, -6], [-3, 5.2, -8], [3.5, 4.6, -7], [9.5, 5, -6.5]].map((p, i) => (
        <Float key={i} speed={1.1} floatIntensity={1} rotationIntensity={0}>
          <group position={p as [number, number, number]} scale={0.7 + (i % 3) * 0.2}>
            {[[0, 0, 0], [0.8, -0.1, 0], [-0.8, -0.1, 0], [0.35, 0.35, 0]].map((o, j) => (
              <mesh key={j} position={o as [number, number, number]}>
                <sphereGeometry args={[0.6, 10, 10]} />
                <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={theme.stars ? 0.35 : 0.95} />
              </mesh>
            ))}
          </group>
        </Float>
      ))}

      {/* sparkles by day, stars by night */}
      {theme.stars ? (
        <Sparkles count={90} scale={[30, 9, 10]} size={2.6} speed={0.12} color="#ffffff" position={[0, 5, -4]} />
      ) : (
        <Sparkles count={40} scale={[26, 6, 8]} size={4} speed={0.3} color="#ffe8a3" position={[0, 2.5, 0]} />
      )}

      <ContactShadows position={[0, 0.01, 0]} opacity={theme.stars ? 0.2 : 0.32} scale={30} blur={2.6} far={4} color="#6b4f4f" />
    </group>
  );
}
