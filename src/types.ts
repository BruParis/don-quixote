export interface EpisodeDef {
  id: string;
  title: string;
  subtitle: string;
  map: string;
  node: { x: number; y: number };
  requiredTriggers: string[];
}

export interface NpcDef {
  id: string;
  name: string;
  sprite: string;
  x: number;
  y: number;
  dialogue?: string;
  minigame?: string;
  required?: boolean;
}

export interface DoorDef {
  x: number;
  y: number;
  to: string;
  spawn: string;
}

/** Multi-tile structure copied from a rectangular region of the tileset. */
export interface StampDef {
  /** Map tile position of the stamp's top-left corner. */
  x: number;
  y: number;
  /** Source rect in the tileset, in tile coords: [col, row, width, height]. */
  src: [number, number, number, number];
  collide?: boolean;
}

export interface MapDef {
  name: string;
  tileset: 'overworld' | 'inner';
  zoom?: number;
  grid: string[];
  /** Optional per-map overrides of the tileset legend (char → tile index). */
  legend?: Record<string, number>;
  stamps?: StampDef[];
  /** Windmill sail sprites, in pixel coords of the rotation center. */
  sails?: { x: number; y: number }[];
  spawns: Record<string, [number, number]>;
  npcs: NpcDef[];
  doors: DoorDef[];
}

export interface DialogueChoice {
  es: string;
  fr: string;
  next?: string;
}

export interface DialogueNode {
  speaker: string;
  es: string;
  fr: string;
  next?: string;
  choices?: DialogueChoice[];
}

export interface DialogueDef {
  start: string;
  nodes: Record<string, DialogueNode>;
}

export interface CharacterPalette {
  shirt: [string, string, string];
  pants?: [string];
  hair?: [string, string];
}

export interface MinigameResult {
  score: number;
  total: number;
  passed: boolean;
}

export interface MinigameDef {
  id: string;
  type: string;
  title: string;
  instructions?: string;
  passRatio?: number;
  // Type-specific payloads (questions / items / pairs) are read by each handler.
  [key: string]: unknown;
}

/** Contract every minigame type implements: render into `container`, call `done` once. */
export type MinigameHandler = (
  container: HTMLElement,
  def: MinigameDef,
  done: (result: MinigameResult) => void
) => void;
