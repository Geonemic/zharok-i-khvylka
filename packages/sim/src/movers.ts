import { GONDOLA_DECK } from './constants';
import type { Level, Signal } from './level';
import type { SimState } from './state';

const mod = (a: number, n: number) => ((a % n) + n) % n;

// Плавна хвиля без Math.sin (дві параболи): ціла арифметика однакова на всіх комп'ютерах
export function wave(phase: number, amp: number): number {
  const p = mod(phase, 1024), q = p & 511;
  const v = Math.trunc((amp * 4 * q * (512 - q)) / (512 * 512));
  return p < 512 ? v : -v;
}

// Плавний хід від 0 до range за n тіків (повільний старт і зупинка) — у цілих числах
export function ease(a: number, n: number, range: number): number {
  if (a <= 0) return 0;
  if (a >= n) return range;
  const q = Math.trunc((a * a * (3 * n - 2 * a) * 4096) / (n * n * n));
  return Math.trunc((range * q) / 4096);
}

// Поверхня води припливу k у тік tick: від відпливу (low) до припливу (high) і назад
export function tideLevel(L: Level, k: number, tick: number): number {
  const t = L.tides[k], u = mod(tick + t.phase, t.period), half = t.period >> 1, range = t.low - t.high;
  return u < half ? t.low - ease(u, half, range) : t.high + ease(u - half, t.period - half, range);
}

// Середина гондоли k: стоїть на x0, пливе до x1, стоїть, пливе назад
export function gondolaX(L: Level, k: number, tick: number): number {
  const g = L.gondolas[k], dist = g.x1 - g.x0, u = mod(tick + g.phase, 2 * (g.wait + g.travel));
  if (u < g.wait) return g.x0;
  if (u < g.wait + g.travel) return g.x0 + ease(u - g.wait, g.travel, dist);
  if (u < 2 * g.wait + g.travel) return g.x1;
  return g.x1 - ease(u - 2 * g.wait - g.travel, g.travel, dist);
}

// Механізм увімкнено, якщо натиснута будь-яка його плита або ввімкнено непарну кількість його важелів
export function signal(s: SimState, sig: Signal): boolean {
  for (const p of sig.plates) if (s.plates[p]) return true;
  let odd = false;
  for (const v of sig.levers) if (s.levers[v]) odd = !odd;
  return odd;
}

// Де зараз рухома платформа k: середина по x і верх
export function moverPos(s: SimState, L: Level, k: number): [number, number] {
  const m = L.movers[k];
  switch (m.kind) {
    case 'lily': { const l = L.lilies[m.ref]; return [l.x, l.y + wave(s.tick * 8 + m.ref * 341, 410) + s.lilySink[m.ref]]; }
    case 'gondola': return [gondolaX(L, m.ref, s.tick), tideLevel(L, L.gondolas[m.ref].tide, s.tick) - GONDOLA_DECK];
    case 'lift': { const l = L.lifts[m.ref]; return [l.x, l.y0 + (l.y1 > l.y0 ? s.lifts[m.ref] : -s.lifts[m.ref])]; }
    case 'pulleyA': { const p = L.pulleys[m.ref]; return [p.a.x, p.a.y + Math.trunc((p.da * s.pulleys[m.ref]) / 1000)]; }
    case 'pulleyB': { const p = L.pulleys[m.ref]; return [p.b.x, p.b.y - Math.trunc((p.db * s.pulleys[m.ref]) / 1000)]; }
  }
}

// Ставить усі рухомі платформи на місця; moving — запам'ятати зсув за крок, щоб везти героїв
export function placeMovers(s: SimState, L: Level, moving: boolean): void {
  for (let k = 0; k < L.movers.length; k++) {
    const [x, y] = moverPos(s, L, k);
    s.mvDx[k] = moving ? x - s.mvX[k] : 0;
    s.mvDy[k] = moving ? y - s.mvY[k] : 0;
    s.mvX[k] = x;
    s.mvY[k] = y;
  }
}
