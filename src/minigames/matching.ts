import type { MinigameHandler } from '../types';
import { el, showResult, shuffled } from './dom';

interface Pair {
  es: string;
  en: string;
}

/** Drag each Spanish card onto its English translation slot. */
export const matching: MinigameHandler = (container, def, done) => {
  const pairs = def.pairs as Pair[];

  const restart = () => {
    container.innerHTML = '';
    let matched = 0;
    let mistakes = 0;

    const status = el('div', 'mg-progress', `Parejas: 0 / ${pairs.length} · Errores: 0`);
    container.appendChild(status);

    const board = el('div', 'mg-match');
    const leftCol = el('div', 'mg-match-col');
    const rightCol = el('div', 'mg-match-col');
    board.appendChild(leftCol);
    board.appendChild(rightCol);
    container.appendChild(board);

    const updateStatus = () => {
      status.textContent = `Parejas: ${matched} / ${pairs.length} · Errores: ${mistakes}`;
    };

    const finish = () => {
      const score = Math.max(pairs.length - mistakes, 0);
      showResult(container, def, score, pairs.length, done, restart);
    };

    for (const pair of shuffled(pairs)) {
      const card = el('div', 'mg-drag', pair.es);
      card.draggable = true;
      card.dataset.es = pair.es;
      card.ondragstart = (e) => {
        if (card.classList.contains('matched')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer!.setData('text/plain', pair.es);
      };
      leftCol.appendChild(card);
    }

    for (const pair of shuffled(pairs)) {
      const slot = el('div', 'mg-drop', pair.en);
      slot.ondragover = (e) => {
        if (!slot.classList.contains('matched')) {
          e.preventDefault();
          slot.classList.add('over');
        }
      };
      slot.ondragleave = () => slot.classList.remove('over');
      slot.ondrop = (e) => {
        e.preventDefault();
        slot.classList.remove('over');
        if (slot.classList.contains('matched')) return;
        const es = e.dataTransfer!.getData('text/plain');
        const isCorrect = pairs.some((p) => p.es === es && p.en === pair.en);
        if (isCorrect) {
          matched++;
          slot.classList.add('matched');
          slot.textContent = `${es} = ${pair.en}`;
          const card = leftCol.querySelector<HTMLElement>(`[data-es="${CSS.escape(es)}"]`);
          card?.classList.add('matched');
          card?.setAttribute('draggable', 'false');
          updateStatus();
          if (matched === pairs.length) setTimeout(finish, 700);
        } else {
          mistakes++;
          slot.classList.add('flash');
          setTimeout(() => slot.classList.remove('flash'), 500);
          updateStatus();
        }
      };
      rightCol.appendChild(slot);
    }
  };

  restart();
};
