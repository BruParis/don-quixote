import Phaser from 'phaser';
import type { DialogueDef, DialogueNode } from '../types';
import { DIALOGUES } from '../data';
import { closeOverlay } from '../core/overlay';
import { showTranslations, toggleTranslations } from '../core/progress';
import { FONT_FAMILY } from '../core/theme';

interface DialogueData {
  dialogueId: string;
  parentKey: string;
  onDone?: () => void;
}

/** Reusable overlay text box for story dialogue: Spanish text, translation toggle, branching choices. */
export class DialogueScene extends Phaser.Scene {
  private dlg!: DialogueDef;
  private parentKey!: string;
  private onDone?: () => void;
  private nodeId!: string;
  private readyAt = 0;

  private speakerText!: Phaser.GameObjects.Text;
  private esText!: Phaser.GameObjects.Text;
  private frText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Dialogue');
  }

  init(data: DialogueData): void {
    this.dlg = DIALOGUES[data.dialogueId];
    this.parentKey = data.parentKey;
    this.onDone = data.onDone;
    this.choiceTexts = [];
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35);

    const boxY = H - 170;
    this.add.rectangle(W / 2, boxY + 75, W - 80, 150, 0x140e08, 0.94).setStrokeStyle(2, 0x7a5a2b);

    this.speakerText = this.add
      .text(56, boxY - 16, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: '#f5e9d0',
        backgroundColor: '#7a5a2b',
        padding: { x: 10, y: 4 }
      })
      .setDepth(1);

    this.esText = this.add.text(60, boxY + 16, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '21px',
      lineSpacing: 8,
      color: '#f5e9d0',
      wordWrap: { width: W - 160 }
    });

    this.frText = this.add.text(60, boxY + 78, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      lineSpacing: 6,
      color: '#b9a888',
      wordWrap: { width: W - 160 }
    });

    this.hintText = this.add
      .text(W - 56, H - 34, 'Espacio: continuar · T: traducción', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: '#8f7c5c'
      })
      .setOrigin(1, 0.5);

    this.nodeId = this.dlg.start;
    this.readyAt = this.time.now + 250;

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.advance());
    kb.on('keydown-ENTER', () => this.advance());
    kb.on('keydown-T', () => {
      toggleTranslations();
      this.renderNode();
    });
    this.input.on('pointerdown', () => this.advance());

    this.renderNode();
  }

  private currentNode(): DialogueNode {
    return this.dlg.nodes[this.nodeId];
  }

  private renderNode(): void {
    const node = this.currentNode();
    this.speakerText.setText(node.speaker);
    this.esText.setText(node.es);
    this.frText.setText(showTranslations() ? `FR : ${node.fr}` : '');

    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];

    if (node.choices) {
      this.hintText.setText('Elige una respuesta · T: traducción');
      const W = this.scale.width;
      node.choices.forEach((choice, i) => {
        const label = showTranslations() ? `▸ ${choice.es}  (FR : ${choice.fr})` : `▸ ${choice.es}`;
        const t = this.add
          .text(W / 2, this.scale.height - 260 + i * 40, label, {
            fontFamily: FONT_FAMILY,
            fontSize: '19px',
            color: '#f5e9d0',
            backgroundColor: '#3a2c18',
            padding: { x: 14, y: 7 }
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        t.on('pointerover', () => t.setBackgroundColor('#7a5a2b'));
        t.on('pointerout', () => t.setBackgroundColor('#3a2c18'));
        t.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.choose(i);
        });
        this.choiceTexts.push(t);
      });
    } else {
      this.hintText.setText('Espacio: continuar · T: traducción');
    }
  }

  private advance(): void {
    if (this.time.now < this.readyAt) return;
    const node = this.currentNode();
    if (node.choices) return; // must pick a choice
    if (node.next) {
      this.nodeId = node.next;
      this.renderNode();
    } else {
      this.finish();
    }
  }

  private choose(i: number): void {
    const next = this.currentNode().choices?.[i]?.next;
    if (next) {
      this.nodeId = next;
      this.renderNode();
    } else {
      this.finish();
    }
  }

  private finish(): void {
    const cb = this.onDone;
    closeOverlay(this, this.parentKey);
    cb?.();
  }
}
