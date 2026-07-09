/**
 * games.ts — the mini-arcade registry. Adding a game = one entry here:
 * build a component that takes GameProps, speak over the 'arcade' activity
 * channel with a unique message-key prefix, and register it below.
 */

import type { ComponentType } from 'react';

export interface GameProps {
  role: 'host' | 'guest';
  onExit: () => void;
}

export interface ArcadeGame {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** lazy import keeps each game its own chunk */
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}

export const GAMES: ArcadeGame[] = [
  {
    id: 'reaction',
    name: 'reaction duel',
    emoji: '⚡',
    blurb: 'same signal, both screens — fastest tap wins. first to 3.',
    load: () => import('./ReactionDuel'),
  },
  {
    id: 'memory',
    name: 'memory match race',
    emoji: '🧠',
    blurb: 'identical boards, 30 seconds — who pairs more emoji?',
    load: () => import('./MemoryMatch'),
  },
];
