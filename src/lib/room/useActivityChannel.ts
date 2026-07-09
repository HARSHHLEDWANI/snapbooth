'use client';

/**
 * useActivityChannel — a typed lane over the room's `act` message namespace.
 * Every activity gets its own channel keyed by its ActivityId, so all the
 * date games multiplex over the ONE existing data connection.
 */

import { useCallback, useEffect, useRef } from 'react';
import { getActiveRoom } from '@/lib/room/room';
import type { ActivityId } from '@/store/useBoothStore';

export function useActivityChannel<T>(a: ActivityId, onMsg?: (m: T) => void) {
  const handler = useRef(onMsg);
  handler.current = onMsg;

  useEffect(() => {
    const room = getActiveRoom();
    if (!room) return;
    return room.on((msg) => {
      if (msg.t === 'act' && msg.a === a) handler.current?.(msg.m as T);
    });
  }, [a]);

  return useCallback((m: T) => {
    getActiveRoom()?.send({ t: 'act', a, m });
  }, [a]);
}
