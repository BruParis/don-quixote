import type { MinigameDef, MinigameResult } from '../types';

export function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Lenient answer comparison: case, spacing and accent insensitive. */
export function answersMatch(given: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  return norm(given) === norm(expected);
}

export function isPassed(def: MinigameDef, score: number, total: number): boolean {
  const ratio = typeof def.passRatio === 'number' ? def.passRatio : 0.7;
  return score >= Math.ceil(total * ratio);
}

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shared end-of-minigame screen with retry option. */
export function showResult(
  container: HTMLElement,
  def: MinigameDef,
  score: number,
  total: number,
  done: (result: MinigameResult) => void,
  retry: () => void
): void {
  const passed = isPassed(def, score, total);
  container.innerHTML = '';
  const box = el('div', 'mg-result');
  box.appendChild(el('h2', undefined, passed ? '¡Excelente!' : 'Casi... ¡inténtalo otra vez!'));
  box.appendChild(el('div', 'score', `Puntuación: ${score} / ${total}`));
  box.appendChild(
    el('div', 'mg-translation', passed ? 'You passed this challenge!' : 'You need more correct answers to pass.')
  );

  const cont = el('button', 'mg-btn', 'Continuar') as HTMLButtonElement;
  cont.onclick = () => done({ score, total, passed });
  box.appendChild(cont);

  const again = el('button', 'mg-btn', 'Reintentar') as HTMLButtonElement;
  again.onclick = retry;
  box.appendChild(again);

  container.appendChild(box);
}
