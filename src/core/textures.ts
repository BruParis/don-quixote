import Phaser from 'phaser';

export const TILE = 16;

/**
 * Tile legends: map-JSON legend character → tile index in the CC0 tilesets
 * (assets/Overworld.png and assets/Inner.png, 40 columns of 16x16 tiles).
 * Multi-tile structures (houses, furniture...) are placed via map "stamps".
 */
const OVERWORLD_COLS = 40;
const ow = (col: number, row: number) => row * OVERWORLD_COLS + col;

export const LEGENDS: Record<string, Record<string, number>> = {
  overworld: {
    G: ow(0, 3), // grass
    P: ow(12, 19), // dirt path
    W: ow(6, 4), // pond water
    T: ow(0, 6), // bush/tree
    C: ow(0, 34) // crop rows
  },
  inner: {
    F: ow(0, 1), // sandstone brick floor
    H: ow(2, 1), // dark panel wall
    R: ow(1, 8), // green carpet
    B: ow(6, 8) // grey brick wall (inn variant)
  }
};

export const COLLIDE_CHARS: Record<string, string[]> = {
  overworld: ['W', 'T'],
  inner: ['H', 'B']
};

export const TILESET_TEXTURE: Record<string, string> = {
  overworld: 'tiles_overworld',
  inner: 'tiles_inner'
};

/** Small procedural extras that have no counterpart in the pack. */
export function createMarkerTextures(scene: Phaser.Scene): void {
  // "!" event marker (e.g. the windmill "giant")
  const sign = scene.add.graphics();
  sign.fillStyle(0x000000, 0.25);
  sign.fillEllipse(8, 15, 10, 3);
  sign.fillStyle(0xe8c86a, 1);
  sign.fillCircle(8, 7, 6);
  sign.lineStyle(1, 0x7a5a2b, 1);
  sign.strokeCircle(8, 7, 6);
  sign.fillStyle(0x2b2013, 1);
  sign.fillRect(7, 3, 2, 5);
  sign.fillRect(7, 9, 2, 2);
  sign.generateTexture('sign', 16, 16);
  sign.destroy();

  // completion check mark
  const check = scene.add.graphics();
  check.fillStyle(0x2e7d1f, 1);
  check.fillCircle(6, 6, 5);
  check.lineStyle(2, 0xffffff, 1);
  check.beginPath();
  check.moveTo(3, 6);
  check.lineTo(5, 8);
  check.lineTo(9, 4);
  check.strokePath();
  check.generateTexture('check', 12, 12);
  check.destroy();

  // windmill sails: 4-blade cross, rotated at runtime
  const sails = scene.add.graphics();
  sails.lineStyle(3, 0x5c4426, 1);
  sails.beginPath();
  sails.moveTo(24, 0);
  sails.lineTo(24, 48);
  sails.moveTo(0, 24);
  sails.lineTo(48, 24);
  sails.strokePath();
  sails.fillStyle(0xe8dcc0, 0.9);
  sails.fillTriangle(24, 2, 34, 2, 24, 20);
  sails.fillTriangle(46, 24, 46, 34, 28, 24);
  sails.fillTriangle(24, 46, 14, 46, 24, 28);
  sails.fillTriangle(2, 24, 2, 14, 20, 24);
  sails.generateTexture('sails', 48, 48);
  sails.destroy();
}
