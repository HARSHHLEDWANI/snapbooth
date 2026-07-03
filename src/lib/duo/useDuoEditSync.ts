'use client';

/**
 * useDuoEditSync — keeps the edit state mirrored between the two peers.
 * Last-writer-wins over the data channel, throttled so sticker drags don't
 * flood the wire. Undo/redo history stays local to each person.
 */

import { useEffect, useRef } from 'react';
import { useBoothStore } from '@/store/useBoothStore';
import { getActiveRoom } from '@/lib/duo/room';

const THROTTLE_MS = 80;

export function useDuoEditSync() {
  const connected = useBoothStore((s) => s.duo.connected);
  const applying = useRef(false);
  const lastSent = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const room = getActiveRoom();
    if (!room || !connected) return;

    const off = room.on((msg) => {
      if (msg.t === 'edit') {
        applying.current = true;
        useBoothStore.setState({ edit: msg.edit });
        applying.current = false;
      } else if (msg.t === 'retake') {
        // partner wants a do-over — head back into the booth together
        useBoothStore.getState().setPhase('capture');
      }
    });

    const send = () => {
      lastSent.current = Date.now();
      room.send({ t: 'edit', edit: useBoothStore.getState().edit });
    };

    const unsub = useBoothStore.subscribe((s, prev) => {
      if (applying.current || s.edit === prev.edit) return;
      const since = Date.now() - lastSent.current;
      if (since >= THROTTLE_MS) {
        send();
      } else {
        // trailing send so the final drag position always lands
        if (trailing.current) clearTimeout(trailing.current);
        trailing.current = setTimeout(send, THROTTLE_MS - since);
      }
    });

    return () => {
      off();
      unsub();
      if (trailing.current) clearTimeout(trailing.current);
    };
  }, [connected]);
}
