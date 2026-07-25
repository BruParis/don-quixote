import Phaser from 'phaser';

/**
 * Character sprites are palette swaps of the CC0 hero walk sheet
 * (assets/character.png, 16x32 frames, rows = down/left/up/right).
 * Each character remaps the hero's shirt / pants / hair colors.
 */

const FRAME_W = 16;
const FRAME_H = 32;
const SHEET_COLS = 17;

// Source palette of character.png
const SRC = {
  shirt: ['#C43C3C', '#882E2E', '#681C1C'],
  pants: ['#65659B'],
  hair: ['#6A4834', '#432E27']
};

interface Palette {
  shirt: [string, string, string];
  pants?: [string];
  hair?: [string, string];
}

const CHARACTERS: Record<string, Palette> = {
  quijote: { shirt: ['#b9bfc9', '#878e9a', '#5b616c'], pants: ['#4a4f58'], hair: ['#9aa0ab', '#6e747e'] },
  sancho: { shirt: ['#8aa03f', '#66782c', '#48561d'], pants: ['#6b4a2b'] },
  sobrina: { shirt: ['#d97fa6', '#a85a7e', '#7c3f5c'] },
  barbero: { shirt: ['#4d7ea8', '#38618a', '#264a6e'] },
  cura: { shirt: ['#4a4a4a', '#333333', '#212121'], hair: ['#8a8a8a', '#5f5f5f'] },
  ama: { shirt: ['#a8764a', '#82552f', '#5c3a1e'], hair: ['#bdbdbd', '#8a8a8a'] },
  moza: { shirt: ['#4f9d69', '#3a7a4f', '#285c39'] },
  ventero: { shirt: ['#c49040', '#96692c', '#6e4b1e'], pants: ['#5c3a1e'] },
  arriero: { shirt: ['#7a7a7a', '#5a5a5a', '#404040'], hair: ['#2b2118', '#1a140e'] }
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function buildColorMap(palette: Palette): Map<number, [number, number, number]> {
  const map = new Map<number, [number, number, number]>();
  const add = (from: string, to: string) => {
    const [r, g, b] = hexToRgb(from);
    map.set((r << 16) | (g << 8) | b, hexToRgb(to));
  };
  SRC.shirt.forEach((c, i) => add(c, palette.shirt[i]));
  if (palette.pants) add(SRC.pants[0], palette.pants[0]);
  if (palette.hair) SRC.hair.forEach((c, i) => add(c, palette.hair![i]));
  return map;
}

/** Build one recolored spritesheet texture + walk/idle animations per character. */
export function buildCharacterTextures(scene: Phaser.Scene): void {
  const baseImg = scene.textures.get('char_base').getSourceImage() as HTMLImageElement;

  for (const [name, palette] of Object.entries(CHARACTERS)) {
    const key = `char_${name}`;
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

    const tex = scene.textures.addCanvas(key, canvas)!;
    // frames 0-3 down, 4-7 left, 8-11 up, 12-15 right (walk cycles)
    const dirs = ['down', 'left', 'up', 'right'];
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
