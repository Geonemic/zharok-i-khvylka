import { z } from 'zod';

// Формат рівня. Збільшуй LEVEL_FORMAT при кожній несумісній зміні й додавай міграцію в MIGRATIONS.
export const LEVEL_FORMAT = 1;
export const TILE_PX = 40;

// Тайли: # камінь · . порожньо · F жар · W вода · B трясовина · = дерев'яна платформа (застрибується знизу)
export const TILE_CHARS = '#.FWB=';

const int = z.number().int();
const Point = z.object({ x: int, y: int });
// Що керує воротами чи ліфтом: натиснута будь-яка плита АБО непарна кількість увімкнених важелів
// (як прохідні вимикачі світла: будь-який важіль перемикає механізм)
const Signal = { plates: z.array(int.nonnegative()).default([]), levers: z.array(int.nonnegative()).default([]) };

// Усі координати — у пікселях; y предметів на землі — це рівень землі під ногами
export const LevelSchema = z
  .object({
    format: z.literal(LEVEL_FORMAT),
    id: z.string().min(1),
    theme: z.string().min(1),
    name: z.object({ uk: z.string().min(1), en: z.string().min(1) }),
    tiles: z.array(z.string()).min(3),
    spawns: z.object({ zharok: Point, khvylka: Point }),
    checkpoints: z.array(Point).default([]),
    items: z.array(z.object({ kind: z.enum(['spark', 'drop', 'heart']), x: int, y: int })).default([]),
    plates: z.array(z.object({ x: int, y: int, w: int.positive().default(32) })).default([]),
    gates: z.array(z.object({ x: int, top: int, h: int.positive(), ...Signal })).default([]),
    lilies: z.array(Point).default([]),
    // Важіль: x — середина, y — земля. Перемикається, коли герой проходить крізь нього (праворуч — увімк.)
    levers: z.array(z.object({ x: int, y: int, on: z.boolean().default(false) })).default([]),
    // Ліфт: x — середина, y0 — верх у спокої, y1 — верх, коли увімкнений
    lifts: z.array(z.object({ x: int, w: int.positive().default(72), y0: int, y1: int, ...Signal })).default([]),
    // Противага: коли на важкій платформі a хтось стоїть, вона опускається на da, а платформа b піднімається на db
    pulleys: z.array(z.object({ a: Point, b: Point, w: int.positive().default(72), da: int.nonnegative(), db: int.nonnegative() })).default([]),
    // Приплив: вода між x0 і x1 від дна bottom; поверхня плавно ходить від low (відплив) до high (приплив) і назад
    tides: z.array(z.object({ x0: int, x1: int, bottom: int, low: int, high: int, period: int.min(60).max(3600), phase: int.default(0) })).default([]),
    // Гондола пливе по воді припливу tide між серединами x0 і x1: travel тіків у дорозі, wait — стоянка на кінцях
    gondolas: z.array(z.object({ tide: int.nonnegative(), x0: int, x1: int, w: int.positive().default(120), travel: int.positive().max(3600), wait: int.nonnegative().default(0), phase: int.default(0) })).default([]),
    doors: z.object({ zharok: Point, khvylka: Point }),
  })
  .superRefine((lvl, ctx) => {
    const w = lvl.tiles[0].length;
    lvl.tiles.forEach((row, r) => {
      if (row.length !== w) ctx.addIssue({ code: 'custom', path: ['tiles', r], message: `рядок ${r} має довжину ${row.length}, а очікується ${w}` });
      for (const ch of row) if (!TILE_CHARS.includes(ch)) ctx.addIssue({ code: 'custom', path: ['tiles', r], message: `невідомий тайл «${ch}»` });
    });
    const signals = (list: { plates: number[]; levers: number[] }[], name: string) => list.forEach((g, i) => {
      if (!g.plates.length && !g.levers.length) ctx.addIssue({ code: 'custom', path: [name, i], message: 'потрібна хоча б одна плита чи важіль' });
      for (const p of g.plates) if (p >= lvl.plates.length) ctx.addIssue({ code: 'custom', path: [name, i, 'plates'], message: `плити ${p} не існує` });
      for (const v of g.levers) if (v >= lvl.levers.length) ctx.addIssue({ code: 'custom', path: [name, i, 'levers'], message: `важеля ${v} не існує` });
    });
    signals(lvl.gates, 'gates');
    signals(lvl.lifts, 'lifts');
    lvl.tides.forEach((t, i) => {
      if (t.x1 <= t.x0 || t.high > t.low || t.low > t.bottom) ctx.addIssue({ code: 'custom', path: ['tides', i], message: 'має бути x0 < x1 і high ≤ low ≤ bottom' });
    });
    lvl.gondolas.forEach((g, i) => {
      if (g.tide >= lvl.tides.length) ctx.addIssue({ code: 'custom', path: ['gondolas', i, 'tide'], message: `припливу ${g.tide} не існує` });
    });
  });

export type LevelData = z.output<typeof LevelSchema>;
export type ItemKind = LevelData['items'][number]['kind'];

// Міграції: ключ — версія, з якої переводимо на наступну
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export function parseLevel(raw: unknown): LevelData {
  let data = { ...(raw as Record<string, unknown>) };
  let v = typeof data.format === 'number' ? data.format : 0;
  while (v < LEVEL_FORMAT) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`Немає міграції рівня з версії ${v}`);
    data = m(data);
    v++;
    data.format = v;
  }
  return LevelSchema.parse(data);
}
