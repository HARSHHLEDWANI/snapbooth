'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text, Float, Sparkles, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { APP_NAME } from '@/config/app';
import { useBoothStore } from '@/store/useBoothStore';
import { play } from '@/lib/sound/sound';

const PINK = '#ff8fab';
const BLUSH = '#ffd6e0';
const BUTTER = '#ffe8a3';
const CREAM = '#fff8f0';
const BROWN = '#6b4f4f';

/** The whole exterior scene: a low-poly pastel photobooth in a dreamy sky. */
export function BoothExterior({ onEntered, onEnterClick }: { onEntered: () => void; onEnterClick: () => void }) {
  const { camera } = useThree();
  const rig = useRef<THREE.Group>(null);
  const curtainL = useRef<THREE.Mesh>(null);
  const curtainR = useRef<THREE.Mesh>(null);
  const sign = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const entering = useRef(false);
  const phase = useBoothStore((s) => s.phase);

  // frame the whole booth nicely on mount
  useEffect(() => {
    camera.lookAt(0, 1.55, 0);
  }, [camera]);

  // trigger dolly-in when phase flips to 'entering' (effect, not during render)
  useEffect(() => {
    if (phase !== 'entering' || entering.current) return;
    entering.current = true;
    play('whir');
    // part the curtains, then dolly the camera through them
    if (curtainL.current) gsap.to(curtainL.current.position, { x: -1.7, duration: 0.9, ease: 'power2.inOut' });
    if (curtainR.current) gsap.to(curtainR.current.position, { x: 1.7, duration: 0.9, ease: 'power2.inOut' });
    const look = { x: 0, y: 1.55, z: 0 };
    const tl = gsap.timeline({ delay: 0.3, onComplete: onEntered });
    tl.to(camera.position, {
      x: 0, y: 1.2, z: 1.3, duration: 1.35, ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(look.x, look.y, look.z),
    })
      .to(look, { y: 1.3, z: 0.4, duration: 1.35, ease: 'power2.inOut' }, '<')
      .to(camera.position, {
        z: -0.4, y: 1.25, duration: 0.5, ease: 'power2.in',
        onUpdate: () => camera.lookAt(look.x, look.y, look.z),
      }, '>-0.05');
  }, [phase, camera, onEntered]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (!entering.current && rig.current) {
      // slow idle orbit of the whole rig
      rig.current.rotation.y = Math.sin(t * 0.18) * 0.22;
    }
    // curtain sway
    if (!entering.current) {
      if (curtainL.current) curtainL.current.rotation.z = Math.sin(t * 0.9) * 0.03;
      if (curtainR.current) curtainR.current.rotation.z = -Math.sin(t * 0.9 + 1) * 0.03;
    }
    // rotating "photos here" arrow
    if (arrow.current) arrow.current.rotation.z = Math.sin(t * 1.2) * 0.35;
    // sign flicker
    if (sign.current) {
      const flicker = Math.random() > 0.985 ? 0.4 : 1;
      const mat = (sign.current.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 0.8 * flicker + Math.sin(t * 2) * 0.05;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={20}
      />
      <hemisphereLight args={[BLUSH, CREAM, 0.5]} />
      <fog attach="fog" args={[BLUSH, 8, 20]} />

      <group
        ref={rig}
        position={[0, -0.3, 0]}
        onClick={(e) => { e.stopPropagation(); onEnterClick(); }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {/* booth body */}
        <RoundedBox args={[3, 3.6, 2.4]} radius={0.18} smoothness={4} position={[0, 1.1, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={PINK} roughness={0.6} />
        </RoundedBox>
        {/* cream inner face */}
        <RoundedBox args={[2.3, 2.6, 0.1]} radius={0.12} position={[0, 1.2, 1.16]}>
          <meshStandardMaterial color={CREAM} roughness={0.8} />
        </RoundedBox>
        {/* screen hint */}
        <RoundedBox args={[1.5, 1.1, 0.06]} radius={0.08} position={[0, 1.55, 1.22]}>
          <meshStandardMaterial color={BROWN} roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 1.55, 1.26]}>
          <planeGeometry args={[1.35, 0.95]} />
          <meshStandardMaterial color={BLUSH} emissive={BLUSH} emissiveIntensity={0.4} />
        </mesh>

        {/* roof */}
        <RoundedBox args={[3.3, 0.4, 2.7]} radius={0.1} position={[0, 3.05, 0]} castShadow>
          <meshStandardMaterial color={BUTTER} roughness={0.6} />
        </RoundedBox>
        {/* stripey awning */}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} position={[-1.35 + i * 0.45, 2.78, 1.36]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.42, 0.35, 0.04]} />
            <meshStandardMaterial color={i % 2 ? PINK : CREAM} />
          </mesh>
        ))}

        {/* glowing sign */}
        <group ref={sign} position={[0, 3.65, 0.6]}>
          <Text
            font={undefined}
            fontSize={0.52}
            color={PINK}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor={BROWN}
          >
            {APP_NAME}
            <meshStandardMaterial attach="material" color={PINK} emissive={PINK} emissiveIntensity={0.8} toneMapped={false} />
          </Text>
        </group>

        {/* curtains at the entrance */}
        <mesh ref={curtainL} position={[-0.72, 1.2, 1.18]} castShadow>
          <boxGeometry args={[0.75, 2.5, 0.08]} />
          <meshStandardMaterial color="#ff9fb6" roughness={0.7} />
        </mesh>
        <mesh ref={curtainR} position={[0.72, 1.2, 1.18]} castShadow>
          <boxGeometry args={[0.75, 2.5, 0.08]} />
          <meshStandardMaterial color="#ff9fb6" roughness={0.7} />
        </mesh>

        {/* legs */}
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} position={[x, -0.4, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 0.7, 12]} />
            <meshStandardMaterial color={BROWN} />
          </mesh>
        ))}

        {/* rotating "photos here!" arrow sign */}
        <Float speed={2} rotationIntensity={0} floatIntensity={0.6}>
          <group ref={arrow} position={[2.1, 1.8, 0.8]}>
            <mesh>
              <circleGeometry args={[0.55, 24]} />
              <meshStandardMaterial color={BUTTER} />
            </mesh>
            <Text position={[0, 0.12, 0.01]} fontSize={0.16} color={BROWN} anchorX="center">photos</Text>
            <Text position={[0, -0.05, 0.01]} fontSize={0.16} color={BROWN} anchorX="center">here!</Text>
            <mesh position={[0, -0.42, 0.01]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.18, 0.3, 3]} />
              <meshStandardMaterial color={PINK} />
            </mesh>
          </group>
        </Float>
      </group>

      {/* floaty clouds */}
      {[[-4, 3, -3], [4.5, 3.6, -4], [-3.5, 1.2, -5], [3.6, 1.6, -3.5]].map((p, i) => (
        <Float key={i} speed={1.2} floatIntensity={1.2} rotationIntensity={0}>
          <group position={p as [number, number, number]} scale={0.6 + (i % 3) * 0.15}>
            {[[0, 0, 0], [0.8, -0.1, 0], [-0.8, -0.1, 0], [0.35, 0.35, 0]].map((o, j) => (
              <mesh key={j} position={o as [number, number, number]}>
                <sphereGeometry args={[0.6, 12, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={1} />
              </mesh>
            ))}
          </group>
        </Float>
      ))}

      <Sparkles count={40} scale={[12, 6, 6]} size={4} speed={0.3} color={BUTTER} position={[0, 2, 0]} />
      <ContactShadows position={[0, -0.72, 0]} opacity={0.35} scale={10} blur={2.4} far={4} color={BROWN} />
    </group>
  );
}
