'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { initSound } from '@/lib/sound/sound';
import { shouldSuggestLite } from '@/lib/device';
import { Landing } from '@/components/booth3d/Landing';
import { NamePrompt } from '@/components/ui/NamePrompt';
import { Toaster } from '@/components/ui/toast';

// heavy phases are separate chunks
const CaptureView = dynamic(() => import('@/components/capture/CaptureView').then((m) => m.CaptureView), { ssr: false });
const EditScreen = dynamic(() => import('@/components/edit/EditScreen').then((m) => m.EditScreen), { ssr: false });

export function Experience() {
  const phase = useBoothStore((s) => s.phase);
  const nameAsked = useBoothStore((s) => s.nameAsked);
  const hydrate = useBoothStore((s) => s.hydrate);
  const setLite = useBoothStore((s) => s.setLite);

  useEffect(() => {
    hydrate();
    // suggest lite mode on constrained devices (unless user already chose)
    if (localStorage.getItem('snapbooth:lite') === null && shouldSuggestLite()) {
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
      {!nameAsked && <NamePrompt />}
      <Toaster />
    </>
  );
}
