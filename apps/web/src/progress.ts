import type { LevelResult } from './game/engine';

// Найкращі результати рівнів у браузері гравця (згодом — у хмарі, етап 5)
export interface Best { stars: number; diamond: boolean; time: number }
const KEY = 'zh-progress-v1';

export function loadProgress(): Record<string, Best> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Best>; } catch { return {}; }
}

export function saveResult(levelId: string, r: LevelResult): { best: Best; improved: boolean } {
  const all = loadProgress(), prev = all[levelId];
  const best: Best = {
    stars: Math.max(prev?.stars ?? 0, r.stars),
    diamond: (prev?.diamond ?? false) || r.diamond,
    time: prev ? Math.min(prev.time, r.time) : r.time,
  };
  const improved = !prev || best.stars > prev.stars || best.diamond !== prev.diamond || best.time < prev.time;
  all[levelId] = best;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* без сховища — лише на цю сесію */ }
  return { best, improved };
}
