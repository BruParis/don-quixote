import type { MinigameHandler } from '../types';
import { multipleChoice } from './multipleChoice';
import { conjugation, fillInBlank } from './typedAnswer';
import { matching } from './matching';

/**
 * Minigame framework registry. To add a new Spanish-exercise type:
 * implement a MinigameHandler, register it here under a new `type`,
 * and reference that type from a JSON file in src/data/minigames/.
 * No scene code needs to change.
 */
export const MINIGAME_REGISTRY: Record<string, MinigameHandler> = {
  'multiple-choice': multipleChoice,
  'fill-in-blank': fillInBlank,
  conjugation,
  matching
};
