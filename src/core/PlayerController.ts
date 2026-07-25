import Phaser from 'phaser';

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
}

const IDLE_FRAME: Record<string, number> = { down: 0, left: 4, up: 8, right: 12 };

/**
 * Reusable 4-directional top-down movement, shared by every exploration scene.
 * Handles arrow keys + WASD, diagonal normalization and walk animations.
 */
export class PlayerController {
  private keys: MoveKeys;
  private facing: 'down' | 'up' | 'left' | 'right' = 'down';

  constructor(
    scene: Phaser.Scene,
    private sprite: Phaser.Physics.Arcade.Sprite,
    private textureKey: string,
    private speed = 90
  ) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)]
    };
  }

  update(): void {
    const down = (ks: Phaser.Input.Keyboard.Key[]) => ks.some((k) => k.isDown);
    let vx = 0;
    let vy = 0;
    if (down(this.keys.left)) vx -= 1;
    if (down(this.keys.right)) vx += 1;
    if (down(this.keys.up)) vy -= 1;
    if (down(this.keys.down)) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }
    this.sprite.setVelocity(vx * this.speed, vy * this.speed);

    if (vx < 0) this.facing = 'left';
    else if (vx > 0) this.facing = 'right';
    else if (vy < 0) this.facing = 'up';
    else if (vy > 0) this.facing = 'down';

    if (vx !== 0 || vy !== 0) {
      this.sprite.anims.play(`${this.textureKey}-${this.facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(IDLE_FRAME[this.facing]);
    }
  }
}
