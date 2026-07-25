import Phaser from 'phaser';
import type { MinigameDef, MinigameResult } from '../types';
import { MINIGAMES } from '../data';
import { MINIGAME_REGISTRY } from '../minigames';
import { closeOverlay } from '../core/overlay';
import { getMinigameRoot } from '../core/hud';
import { setScore } from '../core/progress';

interface MinigameData {
  minigameId: string;
  parentKey: string;
  onDone?: (result: MinigameResult) => void;
}

/**
 * Overlay scene hosting a DOM-based minigame over the paused exploration scene.
 * The actual exercise UI is rendered by a handler from MINIGAME_REGISTRY,
 * keyed by the minigame's `type` in its JSON config.
 */
export class MinigameScene extends Phaser.Scene {
  private def!: MinigameDef;
  private parentKey!: string;
  private onDone?: (result: MinigameResult) => void;
  private finished = false;

  constructor() {
    super('Minigame');
  }

  init(data: MinigameData): void {
    this.def = MINIGAMES[data.minigameId];
    this.parentKey = data.parentKey;
    this.onDone = data.onDone;
    this.finished = false;
  }

  create(): void {
    // Phaser preventDefault's captured keys (WASD, E, T, space...) globally,
    // which blocks typing into the DOM inputs — suspend capture while open.
    this.input.keyboard?.disableGlobalCapture();

    const root = getMinigameRoot();
    root.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'mg-card';

    const header = document.createElement('div');
    header.className = 'mg-header';
    header.innerHTML = `<span>${this.def.title}</span>`;
    const close = document.createElement('button');
    close.className = 'mg-close';
    close.textContent = '✕';
    close.onclick = () => this.finish({ score: 0, total: 0, passed: false });
    header.appendChild(close);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'mg-body';
    if (this.def.instructions) {
      const instr = document.createElement('div');
      instr.className = 'mg-instructions';
      instr.textContent = this.def.instructions;
      body.appendChild(instr);
    }
    const content = document.createElement('div');
    body.appendChild(content);
    card.appendChild(body);
    root.appendChild(card);
    root.classList.remove('hidden');

    const handler = MINIGAME_REGISTRY[this.def.type];
    if (!handler) {
      console.error(`Unknown minigame type: ${this.def.type}`);
      this.finish({ score: 0, total: 0, passed: false });
      return;
    }
    handler(content, this.def, (result) => this.finish(result));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.enableGlobalCapture();
      root.classList.add('hidden');
      root.innerHTML = '';
    });
  }

  private finish(result: MinigameResult): void {
    if (this.finished) return;
    this.finished = true;
    if (result.total > 0) setScore(this.def.id, result);
    const cb = this.onDone;
    closeOverlay(this, this.parentKey);
    cb?.(result);
  }
}
