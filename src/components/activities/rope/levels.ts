/**
 * levels.ts — "tied together" level registry. Add a level = add one object.
 *
 * Coordinates are in WORLD units: a 1280 × 720 playfield, origin top-left,
 * y grows downward (canvas convention). Design rules that keep the game
 * latency-tolerant: cooperation puzzles, generous platforms, soft hazards
 * (boing back to spawn + giggle counter), never precision-timing jumps.
 *
 * piece types:
 *  - platforms: static ground (blobs walk on these)
 *  - hazards:   sensor zones — touching one boings BOTH blobs to spawn
 *  - anchors:   zones where a blob can HOLD ON (press/hold ⚓) and become an
 *               anchor point so the partner can pendulum-swing on the ribbon
 *  - plates:    pressure plates — held down while a blob stands on them
 *  - doors:     static walls that open (vanish) while `plate` is pressed
 *  - lift:      a counterweight elevator — standing on the weight end raises
 *               the platform end (host enforces the coupling each tick)
 *  - goal:      BOTH blobs inside → level complete
 */

export interface Rect { x: number; y: number; w: number; h: number }

export interface RopeLevel {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  spawnA: { x: number; y: number };
  spawnB: { x: number; y: number };
  platforms: Rect[];
  hazards: Rect[];
  anchors: Rect[];
  plates: Rect[];
  /** doors[i] opens while plates[door.plate] is pressed */
  doors: (Rect & { plate: number })[];
  lift?: { platform: Rect; weight: Rect; travel: number };
  goal: Rect;
}

export const WORLD_W = 1280;
export const WORLD_H = 720;

export const ROPE_LEVELS: RopeLevel[] = [
  {
    id: 'pendulum',
    name: 'the big swing',
    emoji: '💫',
    hint: 'one of you HOLDS ON (⚓) at the edge — the other jumps and swings across on the ribbon!',
    spawnA: { x: 150, y: 520 },
    spawnB: { x: 230, y: 520 },
    platforms: [
      { x: 0, y: 580, w: 420, h: 140 },        // start ledge
      { x: 880, y: 580, w: 400, h: 140 },      // landing ledge
      { x: 1060, y: 460, w: 220, h: 30 },      // step up to the goal
    ],
    hazards: [
      { x: 420, y: 690, w: 460, h: 30 },       // the (very soft) abyss
    ],
    anchors: [
      { x: 330, y: 480, w: 90, h: 100 },       // hold-on zone at the start edge
      { x: 880, y: 480, w: 90, h: 100 },       // and one on the far side to bring the anchor over
    ],
    plates: [],
    doors: [],
    goal: { x: 1120, y: 360, w: 140, h: 100 },
  },
  {
    id: 'plates',
    name: 'the polite door',
    emoji: '🚪',
    hint: 'doors only stay open while someone stands on the plate — take turns holding it for each other.',
    spawnA: { x: 120, y: 520 },
    spawnB: { x: 200, y: 520 },
    platforms: [
      { x: 0, y: 580, w: 1280, h: 140 },       // one long floor
      { x: 500, y: 420, w: 130, h: 24 },       // hop-up shelf mid-room
    ],
    hazards: [],
    anchors: [],
    plates: [
      { x: 330, y: 556, w: 120, h: 24 },       // plate 0 — before door 0
      { x: 830, y: 556, w: 120, h: 24 },       // plate 1 — after door 0, before door 1
    ],
    doors: [
      { x: 620, y: 330, w: 34, h: 250, plate: 0 },
      { x: 1010, y: 330, w: 34, h: 250, plate: 1 },
    ],
    goal: { x: 1130, y: 460, w: 150, h: 120 },
  },
  {
    id: 'pulley',
    name: 'the seesaw lift',
    emoji: '⚖️',
    hint: 'one blob is the counterweight: stand on the weight to lift your person up to the high road.',
    spawnA: { x: 130, y: 520 },
    spawnB: { x: 210, y: 520 },
    platforms: [
      { x: 0, y: 580, w: 560, h: 140 },        // start floor
      { x: 700, y: 300, w: 380, h: 26 },       // the high road
      { x: 1080, y: 300, w: 200, h: 26 },      // goal shelf continues
      { x: 620, y: 580, w: 660, h: 140 },      // lower floor under the high road
    ],
    hazards: [],
    anchors: [
      { x: 700, y: 200, w: 90, h: 100 },       // top-side hold so the second blob can be reeled up
    ],
    plates: [],
    doors: [],
    lift: {
      platform: { x: 560, y: 540, w: 130, h: 22 },  // the lift seat (starts low)
      weight: { x: 420, y: 556, w: 110, h: 24 },    // the counterweight pad
      travel: 260,                                   // how far the seat can rise
    },
    goal: { x: 1150, y: 200, w: 130, h: 100 },
  },
];
