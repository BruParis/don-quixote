import Phaser from 'phaser';

/**
 * Scene transition manager for overlay scenes (dialogue, minigames).
 *
 * Overlays are launched on top of an exploration scene, which is paused —
 * never stopped — so player position, physics and camera state survive.
 * The overlay stops itself and resumes its parent via closeOverlay().
 */
export function launchOverlay(from: Phaser.Scene, key: string, data: Record<string, unknown>): void {
  from.scene.launch(key, { ...data, parentKey: from.scene.key });
  from.scene.pause();
}

export function closeOverlay(overlay: Phaser.Scene, parentKey: string): void {
  overlay.scene.stop();
  overlay.scene.resume(parentKey);
}
