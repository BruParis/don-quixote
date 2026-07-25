/** DOM HUD shown over the canvas during exploration (crisp text regardless of camera zoom). */

let toastTimer: number | undefined;

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function showHud(left: string, right: string): void {
  const hud = el('hud');
  hud.innerHTML = `<span>${left}</span><span class="objectives">${right}</span>`;
  hud.classList.remove('hidden');
}

export function hideHud(): void {
  el('hud').classList.add('hidden');
}

export function showToast(msg: string, ms = 3500): void {
  const toast = el('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.add('hidden'), ms);
}

export function getMinigameRoot(): HTMLElement {
  return el('minigame-root');
}
