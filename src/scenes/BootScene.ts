import Phaser from 'phaser';
import { createMarkerTextures } from '../core/textures';
import { buildCharacterTextures } from '../core/characters';

/** Loads the CC0 tileset/character art, builds recolored sprites, then hands off. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('tiles_overworld', 'assets/Overworld.png');
    this.load.image('tiles_inner', 'assets/Inner.png');
    this.load.image('char_base', 'assets/character.png');
  }

  create(): void {
    createMarkerTextures(this);
    buildCharacterTextures(this);
    this.scene.start('WorldMap');
  }
}
