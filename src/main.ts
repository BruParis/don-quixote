import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { EpisodeScene } from './scenes/EpisodeScene';
import { DialogueScene } from './scenes/DialogueScene';
import { MinigameScene } from './scenes/MinigameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 640,
  backgroundColor: '#1a1410',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, WorldMapScene, EpisodeScene, DialogueScene, MinigameScene]
});

// exposed for debugging and automated screenshots
(window as unknown as { game: Phaser.Game }).game = game;
