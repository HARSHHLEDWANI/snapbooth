'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { initSound } from '@/lib/sound/sound';
import { shouldSuggestLite } from '@/lib/device';
import { useRoomSession } from '@/lib/room/useRoomSession';
import { Landing } from '@/components/hub3d/Landing';
import { Toaster } from '@/components/ui/toast';
import { LS_KEYS } from '@/config/app';

// heavy phases are separate chunks
const CaptureView = dynamic(() => import('@/components/capture/CaptureView').then((m) => m.CaptureView), { ssr: false });
const EditScreen = dynamic(() => import('@/components/edit/EditScreen').then((m) => m.EditScreen), { ssr: false });
const ActivityHost = dynamic(() => import('@/components/activities/ActivityHost').then((m) => m.ActivityHost), { ssr: false });

export function Experience() {
  const phase = useBoothStore((s) => s.phase);
  const hydrate = useBoothStore((s) => s.hydrate);
  const setLite = useBoothStore((s) => s.setLite);

  // one global subscriber for room-level events (hello/bye/navigation)
  useRoomSession();

  useEffect(() => {
    hydrate();
    // suggest lite mode on constrained devices (unless user already chose)
    if (localStorage.getItem(LS_KEYS.liteMode) === null && shouldSuggestLite()) {
      setLite(true);
    }
    const unlock = () => initSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [hydrate, setLite]);

  return (
    <>
      {(phase === 'landing' || phase === 'entering') && <Landing />}
      {phase === 'capture' && <CaptureView />}
      {phase === 'edit' && <EditScreen />}
      {phase === 'activity' && <ActivityHost />}
      <Toaster />
    </>
  );
}
