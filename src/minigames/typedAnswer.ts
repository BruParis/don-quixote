import type { MinigameDef, MinigameHandler, MinigameResult } from '../types';
import { answersMatch, el, showResult } from './dom';

interface TypedItem {
  display: string;
  answer: string;
  fr?: string;
}

/**
 * Shared engine for typed-input drills (fill-in-the-blank, conjugation):
 * shows a sentence, checks a text answer leniently, reveals the correct
 * form + translation, then moves on.
 */
function runTypedDrill(
  container: HTMLElement,
  def: MinigameDef,
  items: TypedItem[],
  done: (result: MinigameResult) => void
): void {
  let idx = 0;
  let score = 0;

  const renderItem = () => {
    container.innerHTML = '';
    const item = items[idx];
    container.appendChild(el('div', 'mg-progress', `Frase ${idx + 1} de ${items.length}`));
    container.appendChild(el('div', 'mg-prompt', item.display));

    const input = el('input', 'mg-input') as HTMLInputElement;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    container.appendChild(input);

    const feedback = el('div', 'mg-feedback');
    const translation = el('div', 'mg-translation');
    const check = el('button', 'mg-btn', 'Comprobar') as HTMLButtonElement;

    const submit = () => {
      if (!input.value.trim()) return;
      input.disabled = true;
      check.disabled = true;
      const ok = answersMatch(input.value, item.answer);
      if (ok) {
        score++;
        feedback.textContent = `¡Correcto! → ${item.answer}`;
        feedback.className = 'mg-feedback ok';
      } else {
        feedback.textContent = `No... la respuesta es: ${item.answer}`;
        feedback.className = 'mg-feedback bad';
      }
      if (item.fr) translation.textContent = item.fr;

      const next = el('button', 'mg-btn', idx + 1 < items.length ? 'Siguiente' : 'Ver resultado') as HTMLButtonElement;
      next.onclick = () => {
        idx++;
        if (idx < items.length) renderItem();
        else showResult(container, def, score, items.length, done, restart);
      };
      container.appendChild(next);
      next.focus();
    };

    check.onclick = submit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') submit();
    };

    container.appendChild(check);
    container.appendChild(feedback);
    container.appendChild(translation);
    input.focus();
  };

  const restart = () => {
    idx = 0;
    score = 0;
    renderItem();
  };

  restart();
}

interface FibItem {
  sentence: string;
  hint?: string;
  answer: string;
  fr?: string;
}

export const fillInBlank: MinigameHandler = (container, def, done) => {
  const items = (def.items as FibItem[]).map((it) => ({
    display: it.hint ? `${it.sentence}  (${it.hint})` : it.sentence,
    answer: it.answer,
    fr: it.fr
  }));
  runTypedDrill(container, def, items, done);
};

interface ConjItem {
  pronoun: string;
  verb: string;
  answer: string;
  fr?: string;
}

export const conjugation: MinigameHandler = (container, def, done) => {
  const items = (def.items as ConjItem[]).map((it) => ({
    display: `${it.pronoun} ___  (${it.verb})`,
    answer: it.answer,
    fr: it.fr
  }));
  runTypedDrill(container, def, items, done);
};
