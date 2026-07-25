import type { MinigameHandler } from '../types';
import { el, showResult } from './dom';

interface MCQuestion {
  prompt: string;
  options: string[];
  answer: number;
}

export const multipleChoice: MinigameHandler = (container, def, done) => {
  const questions = def.questions as MCQuestion[];
  let idx = 0;
  let score = 0;

  const renderQuestion = () => {
    container.innerHTML = '';
    const q = questions[idx];
    container.appendChild(el('div', 'mg-progress', `Pregunta ${idx + 1} de ${questions.length}`));
    container.appendChild(el('div', 'mg-prompt', q.prompt));

    const opts = el('div', 'mg-options');
    q.options.forEach((option, i) => {
      const btn = el('button', 'mg-option', option) as HTMLButtonElement;
      btn.onclick = () => {
        opts.querySelectorAll('button').forEach((b) => (b.disabled = true));
        if (i === q.answer) {
          btn.classList.add('correct');
          score++;
        } else {
          btn.classList.add('wrong');
          (opts.children[q.answer] as HTMLElement).classList.add('correct');
        }
        const next = el('button', 'mg-btn', idx + 1 < questions.length ? 'Siguiente' : 'Ver resultado') as HTMLButtonElement;
        next.onclick = () => {
          idx++;
          if (idx < questions.length) renderQuestion();
          else showResult(container, def, score, questions.length, done, restart);
        };
        container.appendChild(next);
        next.focus();
      };
      opts.appendChild(btn);
    });
    container.appendChild(opts);
  };

  const restart = () => {
    idx = 0;
    score = 0;
    renderQuestion();
  };

  restart();
};
