'use client';

/**
 * useRoomSession — the one global subscriber to room-level events.
 * Mounted once in <Experience/>. Handles the parts of the protocol that
 * outlive any single screen: hello (accent exchange), bye, and the
 * "pull us both somewhere" navigation messages.
 */

import { useEffect } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { getActiveRoom } from '@/lib/room/room';
import { toast } from '@/components/ui/toast';

export function useRoomSession() {
  const connected = useBoothStore((s) => s.duo.connected);

  useEffect(() => {
    const room = getActiveRoom();
    if (!room || !connected) return;

    // introduce ourselves (accent color only — we never ask for names)
    room.ready.then(() => {
      room.send({ t: 'hello', accent: useBoothStore.getState().accent });
    });

    const off = room.on((msg) => {
      const st = useBoothStore.getState();
      switch (msg.t) {
        case 'hello':
          st.setDuo({ partnerAccent: msg.accent });
          break;
        case 'bye':
          st.setDuo({ connected: false });
          toast('your person left the room 💔', 'info');
          break;
        case 'open-activity':
          st.openActivity(msg.a);
          break;
        case 'open-booth':
          if (st.phase !== 'capture') st.setPhase('capture');
          break;
      }
    });
    return off;
  }, [connected]);

  // keep our accent broadcast fresh if the user re-picks it mid-session
  useEffect(() => {
    if (!connected) return;
    const unsub = useBoothStore.subscribe((s, prev) => {
      if (s.accent !== prev.accent) {
        getActiveRoom()?.send({ t: 'hello', accent: s.accent });
      }
    });
    return unsub;
  }, [connected]);
}
