import Phaser from 'phaser';
import type { EpisodeDef, MapDef, NpcDef, StampDef } from '../types';
import { EPISODES, MAPS } from '../data';
import { COLLIDE_CHARS, LEGENDS, TILE, TILESET_TEXTURE } from '../core/textures';
import { PlayerController } from '../core/PlayerController';
import { launchOverlay } from '../core/overlay';
import { hideHud, showHud, showToast } from '../core/hud';
import { isEpisodeComplete, isTriggerDone, markTrigger, showTranslations, toggleTranslations } from '../core/progress';
import { FONT_FAMILY } from '../core/theme';

interface EpisodeData {
  episodeId: string;
  mapId: string;
  spawn: string;
}

interface NpcSprite {
  def: NpcDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  check?: Phaser.GameObjects.Image;
}

const INTERACT_DISTANCE = 26;
const TILESET_COLS = 40;

/**
 * Generic, data-driven exploration scene. One instance serves every map:
 * door transitions restart it with a different mapId, while dialogue and
 * minigame overlays pause/resume it so player state is preserved.
 */
export class EpisodeScene extends Phaser.Scene {
  private episode!: EpisodeDef;
  private mapDef!: MapDef;
  private mapId!: string;
  private spawnKey!: string;

  private player!: Phaser.Physics.Arcade.Sprite;
  private controller!: PlayerController;
  private npcs: NpcSprite[] = [];
  private prompt!: Phaser.GameObjects.Text;

  private keyInteract!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyMap!: Phaser.Input.Keyboard.Key;
  private keyTranslate!: Phaser.Input.Keyboard.Key;

  private busyUntil = 0;
  private overlayActive = false;
  private transitioning = false;

  constructor() {
    super('Episode');
  }

  init(data: EpisodeData): void {
    this.episode = EPISODES.find((e) => e.id === data.episodeId)!;
    this.mapId = data.mapId;
    this.mapDef = MAPS[data.mapId];
    this.spawnKey = data.spawn;
    this.npcs = [];
    this.overlayActive = false;
    this.transitioning = false;
  }

  create(): void {
    const legend = { ...LEGENDS[this.mapDef.tileset], ...this.mapDef.legend };
    const collideChars = COLLIDE_CHARS[this.mapDef.tileset];
    const grid = this.mapDef.grid.map((row) => [...row].map((ch) => legend[ch] ?? 0));

    const map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(TILESET_TEXTURE[this.mapDef.tileset])!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setCollision([...new Set(collideChars.map((ch) => legend[ch]))]);

    const stampBlockers = this.buildStamps(map, tileset);

    const [sx, sy] = this.mapDef.spawns[this.spawnKey] ?? this.mapDef.spawns.default;
    this.player = this.physics.add.sprite(sx * TILE + TILE / 2, sy * TILE + TILE / 2, 'char_quijote', 0);
    this.player.setOrigin(0.5, 0.75); // feet on the tile
    this.player.body!.setSize(12, 10);
    this.player.body!.setOffset(2, 20);
    this.player.setCollideWorldBounds(true);
    this.controller = new PlayerController(this, this.player, 'char_quijote');

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.add.collider(this.player, layer);
    if (stampBlockers) this.physics.add.collider(this.player, stampBlockers);

    const npcGroup = this.physics.add.staticGroup();
    for (const def of this.mapDef.npcs) {
      const isSign = def.sprite === 'sign';
      const tex = isSign ? 'sign' : `char_${def.sprite}`;
      const px = def.x * TILE + TILE / 2;
      const py = def.y * TILE + TILE / 2;
      const sprite = npcGroup.create(px, py, tex, isSign ? undefined : 0) as Phaser.Physics.Arcade.Sprite;
      if (!isSign) {
        sprite.setOrigin(0.5, 0.75);
        sprite.body!.setSize(12, 10);
        (sprite.body as Phaser.Physics.Arcade.StaticBody).position.set(px - 6, py - 2);
      }
      sprite.setDepth(py);
      this.add
        .text(px, py - (isSign ? 10 : 18), def.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '7px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          resolution: 4
        })
        .setOrigin(0.5, 1)
        .setDepth(10000);
      const entry: NpcSprite = { def, sprite };
      if (isTriggerDone(def.id)) this.addCheck(entry);
      this.npcs.push(entry);
    }
    this.physics.add.collider(this.player, npcGroup);

    for (const door of this.mapDef.doors) {
      const zone = this.add.zone(door.x * TILE + TILE / 2, door.y * TILE + TILE / 2, TILE - 4, TILE - 4);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.useDoor(door.to, door.spawn));
    }

    for (const sail of this.mapDef.sails ?? []) {
      const s = this.add.image(sail.x, sail.y, 'sails').setDepth(9000);
      this.tweens.add({ targets: s, angle: 360, duration: 9000, repeat: -1 });
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setZoom(this.mapDef.zoom ?? 3);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.fadeIn(200);

    this.prompt = this.add
      .text(0, 0, '[E] Hablar', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#ffe9a8',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: 4
      })
      .setOrigin(0.5, 1)
      .setDepth(10001)
      .setVisible(false);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keyInteract = kb.addKey(K.E);
    this.keySpace = kb.addKey(K.SPACE);
    this.keyMap = kb.addKey(K.M);
    this.keyTranslate = kb.addKey(K.T);

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.overlayActive = false;
      this.busyUntil = this.time.now + 350;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideHud());

    this.updateHud();
  }

  /** Draw multi-tile structures on a decor layer; collidable ones get static bodies per tile (minus door tiles). */
  private buildStamps(
    map: Phaser.Tilemaps.Tilemap,
    tileset: Phaser.Tilemaps.Tileset
  ): Phaser.Physics.Arcade.StaticGroup | undefined {
    const stamps = this.mapDef.stamps ?? [];
    if (!stamps.length) return undefined;
    const decor = map.createBlankLayer('decor', tileset, 0, 0)!;
    decor.setDepth(1);

    const doorTiles = new Set(this.mapDef.doors.map((d) => `${d.x},${d.y}`));
    const blockers = this.physics.add.staticGroup();

    for (const stamp of stamps) {
      const [srcCol, srcRow, w, h] = stamp.src;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const tx = stamp.x + dx;
          const ty = stamp.y + dy;
          decor.putTileAt((srcRow + dy) * TILESET_COLS + (srcCol + dx), tx, ty);
          if (stamp.collide && !doorTiles.has(`${tx},${ty}`)) {
            const rect = this.add.rectangle(tx * TILE + TILE / 2, ty * TILE + TILE / 2, TILE, TILE);
            rect.setVisible(false);
            blockers.add(rect);
          }
        }
      }
    }
    return blockers;
  }

  update(): void {
    if (this.overlayActive || this.transitioning) return;

    this.controller.update();
    this.player.setDepth(this.player.y);

    const nearest = this.nearestNpc();
    if (nearest) {
      this.prompt.setVisible(true);
      this.prompt.setPosition(nearest.sprite.x, nearest.sprite.y - (nearest.def.sprite === 'sign' ? 12 : 20));
    } else {
      this.prompt.setVisible(false);
    }

    const J = Phaser.Input.Keyboard.JustDown;
    if (this.time.now >= this.busyUntil) {
      if (nearest && (J(this.keyInteract) || J(this.keySpace))) this.interact(nearest);
      if (J(this.keyMap)) this.exitToMap();
      if (J(this.keyTranslate)) {
        toggleTranslations();
        this.updateHud();
      }
    }
  }

  private nearestNpc(): NpcSprite | undefined {
    let best: NpcSprite | undefined;
    let bestDist = INTERACT_DISTANCE;
    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    return best;
  }

  private interact(npc: NpcSprite): void {
    this.player.setVelocity(0, 0);
    this.overlayActive = true;

    const afterDialogue = () => {
      if (npc.def.minigame) {
        this.overlayActive = true;
        launchOverlay(this, 'Minigame', {
          minigameId: npc.def.minigame,
          onDone: (result: { passed: boolean }) => {
            if (result.passed) this.markDone(npc);
          }
        });
      } else {
        this.overlayActive = false;
        this.markDone(npc);
      }
    };

    if (npc.def.dialogue) {
      launchOverlay(this, 'Dialogue', { dialogueId: npc.def.dialogue, onDone: afterDialogue });
    } else {
      afterDialogue();
    }
  }

  private markDone(npc: NpcSprite): void {
    const wasComplete = isEpisodeComplete(this.episode);
    markTrigger(npc.def.id);
    if (!npc.check) this.addCheck(npc);
    this.updateHud();

    if (!wasComplete && isEpisodeComplete(this.episode)) {
      showToast('⚔ ¡Episodio completado! Pulsa M para volver al mapa.', 6000);
    }
  }

  private addCheck(npc: NpcSprite): void {
    // badge sits on the sprite itself (clear of the name label above it)
    npc.check = this.add
      .image(npc.sprite.x + 7, npc.sprite.y - (npc.def.sprite === 'sign' ? 3 : 5), 'check')
      .setDepth(10002);
  }

  private useDoor(to: string, spawn: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(180);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ episodeId: this.episode.id, mapId: to, spawn });
    });
  }

  private exitToMap(): void {
    this.transitioning = true;
    hideHud();
    this.scene.start('WorldMap');
  }

  private updateHud(): void {
    const done = this.episode.requiredTriggers.filter(isTriggerDone).length;
    const total = this.episode.requiredTriggers.length;
    const trans = showTranslations() ? 'ON' : 'OFF';
    showHud(
      `${this.episode.title} — ${this.mapDef.name}`,
      `Objetivos: ${done}/${total} · [E] hablar · [T] traducción: ${trans} · [M] mapa`
    );
  }
}
