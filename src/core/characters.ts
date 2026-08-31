import Phaser from 'phaser';
import { CHARACTER_PALETTES } from '../data';
import type { CharacterPalette } from '../types';

/**
 * Character sprites are palette swaps of the CC0 hero walk sheet
 * (assets/character.png, 16x32 frames, rows = down/left/up/right).
 * Each character remaps the hero's shirt / pants / hair colors, defined
 * in src/data/characters.json (edit via tools/character-builder).
 */

const FRAME_W = 16;
const FRAME_H = 32;
const SHEET_COLS = 17;

// Source palette of character.png
export const SOURCE_PALETTE = {
  shirt: ['#C43C3C', '#882E2E', '#681C1C'],
  pants: ['#65659B'],
  hair: ['#6A4834', '#432E27']
};

/** Character ids with a palette-swapped sprite (excludes procedural sprites like "sign"). */
export const CHARACTER_IDS: string[] = Object.keys(CHARACTER_PALETTES);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function buildColorMap(palette: CharacterPalette): Map<number, [number, number, number]> {
  const map = new Map<number, [number, number, number]>();
  const add = (from: string, to: string) => {
    const [r, g, b] = hexToRgb(from);
    map.set((r << 16) | (g << 8) | b, hexToRgb(to));
  };
  SOURCE_PALETTE.shirt.forEach((c, i) => add(c, palette.shirt[i]));
  if (palette.pants) add(SOURCE_PALETTE.pants[0], palette.pants[0]);
  if (palette.hair) SOURCE_PALETTE.hair.forEach((c, i) => add(c, palette.hair![i]));
  return map;
}

/** Recolor the base spritesheet image for one palette onto a fresh canvas. */
export function recolorSheet(baseImg: HTMLImageElement, palette: CharacterPalette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.width;
  canvas.height = baseImg.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(baseImg, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colorMap = buildColorMap(palette);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const to = colorMap.get(rgb);
    if (to) {
      d[i] = to[0];
      d[i + 1] = to[1];
      d[i + 2] = to[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Build one recolored spritesheet texture + walk/idle animations per character. */
export function buildCharacterTextures(scene: Phaser.Scene): void {
  const baseImg = scene.textures.get('char_base').getSourceImage() as HTMLImageElement;

  for (const [name, palette] of Object.entries(CHARACTER_PALETTES)) {
    const key = `char_${name}`;
    const canvas = recolorSheet(baseImg, palette);

    const tex = scene.textures.addCanvas(key, canvas)!;
    // frames 0-3 down, 4-7 right, 8-11 up, 12-15 left (walk cycles) —
    // the source sheet's row 1 sprite faces right and row 3 faces left.
    const dirs = ['down', 'right', 'up', 'left'];
    dirs.forEach((_, row) => {
      for (let col = 0; col < 4; col++) {
        tex.add(row * 4 + col, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
      }
    });

    dirs.forEach((dir, row) => {
      scene.anims.create({
        key: `${key}-${dir}`,
        frames: scene.anims.generateFrameNumbers(key, {
          frames: [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3]
        }),
        frameRate: 8,
        repeat: -1
      });
    });
  }
}

export const CHAR_SHEET = { FRAME_W, FRAME_H, SHEET_COLS };
