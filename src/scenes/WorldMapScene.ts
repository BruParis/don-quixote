import Phaser from 'phaser';
import { EPISODES, MAPS } from '../data';
import { getScore, isEpisodeComplete, isEpisodeUnlocked, resetProgress, showTranslations, toggleTranslations } from '../core/progress';
import { FONT_FAMILY } from '../core/theme';

/** Map of La Mancha with selectable episode nodes (locked / unlocked / completed). */
export class WorldMapScene extends Phaser.Scene {
  private confirmingReset = false;
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.confirmingReset = false;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2b2013, 0x2b2013, 0x14100a, 0x14100a, 1);
    bg.fillRect(0, 0, W, H);

    // parchment map area
    const parchment = this.add.graphics();
    parchment.fillStyle(0xe8d9b5, 1);
    parchment.fillRoundedRect(60, 120, W - 120, H - 220, 16);
    parchment.lineStyle(4, 0x7a5a2b, 1);
    parchment.strokeRoundedRect(60, 120, W - 120, H - 220, 16);

    this.add
      .text(W / 2, 46, 'DON QUIXOTE', {
        fontFamily: FONT_FAMILY,
        fontSize: '42px',
        color: '#e8c86a',
        stroke: '#4a3413',
        strokeThickness: 6
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 90, 'Una aventura para aprender español', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#b9a888'
      })
      .setOrigin(0.5);

    // route between episode nodes
    const route = this.add.graphics();
    route.lineStyle(3, 0x9a7b45, 0.8);
    for (let i = 0; i < EPISODES.length - 1; i++) {
      const a = EPISODES[i].node;
      const b = EPISODES[i + 1].node;
      route.beginPath();
      const steps = 24;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Phaser.Math.Linear(a.x, b.x, t);
        const y = Phaser.Math.Linear(a.y, b.y, t) + Math.sin(t * Math.PI) * -30;
        if (s === 0) route.moveTo(x, y);
        else route.lineTo(x, y);
      }
      route.strokePath();
    }

    for (const ep of EPISODES) {
      const unlocked = isEpisodeUnlocked(ep);
      const complete = isEpisodeComplete(ep);
      const color = complete ? 0x4f9d3f : unlocked ? 0xe8c86a : 0x8a8175;

      const circle = this.add.circle(ep.node.x, ep.node.y, 26, color).setStrokeStyle(4, 0x4a3413);
      const icon = complete ? '✓' : unlocked ? '⚔' : '🔒';
      this.add
        .text(ep.node.x, ep.node.y, icon, { fontSize: '22px', color: '#2b2013' })
        .setOrigin(0.5);

      this.add
        .text(ep.node.x, ep.node.y + 42, ep.title.replace(/^Episodio \d+: /, ''), {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: '#4a3413',
          align: 'center',
          wordWrap: { width: 200 }
        })
        .setOrigin(0.5, 0);
      this.add
        .text(ep.node.x, ep.node.y + 62, ep.subtitle, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#7a6844'
        })
        .setOrigin(0.5, 0);

      // best minigame scores for this episode's maps
      if (unlocked) {
        const scores: string[] = [];
        for (const trigger of ep.requiredTriggers) {
          for (const m of Object.values(MAPS)) {
            const npc = m.npcs.find((n) => n.id === trigger && n.minigame);
            if (npc?.minigame) {
              const s = getScore(npc.minigame);
              if (s) scores.push(`${s.score}/${s.total}`);
            }
          }
        }
        if (scores.length) {
          this.add
            .text(ep.node.x, ep.node.y - 44, scores.join(' · '), {
              fontFamily: FONT_FAMILY,
              fontSize: '13px',
              color: '#4a3413'
            })
            .setOrigin(0.5);
        }
      }

      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerover', () => circle.setScale(1.15));
        circle.on('pointerout', () => circle.setScale(1));
        circle.on('pointerdown', () => {
          this.scene.start('Episode', { episodeId: ep.id, mapId: ep.map, spawn: 'default' });
        });
        if (!complete) {
          // A single slow pulse draws the eye without looping motion running forever (distracting for ADHD).
          this.tweens.add({
            targets: circle,
            scale: { from: 1, to: 1.08 },
            duration: 1400,
            yoyo: true,
            repeat: 1
          });
        }
      }
    }

    this.footer = this.add
      .text(W / 2, H - 40, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#b9a888'
      })
      .setOrigin(0.5);
    this.updateFooter();

    const kb = this.input.keyboard!;
    kb.on('keydown-T', () => {
      toggleTranslations();
      this.updateFooter();
    });
    kb.on('keydown-R', () => {
      if (!this.confirmingReset) {
        this.confirmingReset = true;
        this.updateFooter();
        this.time.delayedCall(3000, () => {
          this.confirmingReset = false;
          this.updateFooter();
        });
      } else {
        resetProgress();
        this.scene.restart();
      }
    });
  }

  private updateFooter(): void {
    if (this.confirmingReset) {
      this.footer.setText('¿Borrar todo el progreso? Pulsa R otra vez para confirmar.');
      this.footer.setColor('#e08a8a');
    } else {
      const trans = showTranslations() ? 'ON' : 'OFF';
      this.footer.setText(`Haz clic en un episodio para jugar · [T] traducción: ${trans} · [R] reiniciar progreso`);
      this.footer.setColor('#b9a888');
    }
  }
}
