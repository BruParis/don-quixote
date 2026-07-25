import type { EpisodeDef, MinigameResult } from '../types';
import { EPISODES } from '../data';

const STORAGE_KEY = 'dq-progress';

interface SaveData {
  completedTriggers: string[];
  scores: Record<string, { score: number; total: number }>;
  showTranslations: boolean;
}

function defaults(): SaveData {
  return { completedTriggers: [], scores: {}, showTranslations: true };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    /* corrupt save — start fresh */
  }
  return defaults();
}

function save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isTriggerDone(id: string): boolean {
  return data.completedTriggers.includes(id);
}

export function markTrigger(id: string): void {
  if (!isTriggerDone(id)) {
    data.completedTriggers.push(id);
    save();
  }
}

export function setScore(minigameId: string, result: MinigameResult): void {
  const prev = data.scores[minigameId];
  if (!prev || result.score > prev.score) {
    data.scores[minigameId] = { score: result.score, total: result.total };
    save();
  }
}

export function getScore(minigameId: string): { score: number; total: number } | undefined {
  return data.scores[minigameId];
}

export function isEpisodeComplete(ep: EpisodeDef): boolean {
  return ep.requiredTriggers.every(isTriggerDone);
}

export function isEpisodeUnlocked(ep: EpisodeDef): boolean {
  const idx = EPISODES.findIndex((e) => e.id === ep.id);
  if (idx <= 0) return true;
  return isEpisodeComplete(EPISODES[idx - 1]);
}

export function showTranslations(): boolean {
  return data.showTranslations;
}

export function toggleTranslations(): boolean {
  data.showTranslations = !data.showTranslations;
  save();
  return data.showTranslations;
}

export function resetProgress(): void {
  data = defaults();
  save();
}
