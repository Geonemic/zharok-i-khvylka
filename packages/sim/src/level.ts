import { TILE_PX, type LevelData, type ItemKind } from '@zh/levels';
import { SUB, POOL_INSET, ONE_WAY_H, TILE, LILY_W, LILY_H, GONDOLA_H, LIFT_H, PULLEY_H } from './constants';

export const Tile = { Empty: 0, Solid: 1, Fire: 2, Water: 3, Bog: 4, OneWay: 5 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];
const CODE: Record<string, Tile> = { '.': Tile.Empty, '#': Tile.Solid, F: Tile.Fire, W: Tile.Water, B: Tile.Bog, '=': Tile.OneWay };

export const isLiquid = (t: Tile) => t === Tile.Fire || t === Tile.Water || t === Tile.Bog;

export interface Pt { x: number; y: number }
export interface Signal { plates: number[]; levers: number[] }

// Рухома платформа (на неї можна стати згори, вона везе героя). Порядок у списку:
// латаття, гондоли, ліфти, противаги (спершу важка платформа a, потім b).
export type MoverKind = 'lily' | 'gondola' | 'lift' | 'pulleyA' | 'pulleyB';
export interface Mover { kind: MoverKind; ref: number; w: number; h: number }

// Рівень, підготовлений для симуляції: усе в підпікселях
export interface Level {
  data: LevelData;
  cols: number;
  rows: number;
  tiles: Uint8Array;
  spawns: [Pt, Pt];
  checkpoints: Pt[];
  items: { kind: ItemKind; x: number; y: number }[];
  plates: { x: number; y: number; w: number }[];
  gates: ({ x: number; top: number; h: number } & Signal)[];
  lilies: Pt[];
  levers: { x: number; y: number; on: boolean }[];
  lifts: ({ x: number; w: number; y0: number; y1: number } & Signal)[];
  pulleys: { a: Pt; b: Pt; w: number; da: number; db: number }[];
  tides: { x0: number; x1: number; bottom: number; low: number; high: number; period: number; phase: number }[];
  gondolas: { tide: number; x0: number; x1: number; w: number; travel: number; wait: number; phase: number }[];
  movers: Mover[];
  doors: [Pt, Pt];
  gemTotal: number;
}

const sp = (p: Pt): Pt => ({ x: p.x * SUB, y: p.y * SUB });

export function compileLevel(data: LevelData): Level {
  if (TILE_PX * SUB !== TILE) throw new Error('Розмір тайла в форматі й симуляції не збігається');
  const rows = data.tiles.length, cols = data.tiles[0].length;
  const tiles = new Uint8Array(rows * cols);
  data.tiles.forEach((row, r) => { for (let c = 0; c < cols; c++) tiles[r * cols + c] = CODE[row[c]]; });
  const movers: Mover[] = [
    ...data.lilies.map((_, i): Mover => ({ kind: 'lily', ref: i, w: LILY_W, h: LILY_H })),
    ...data.gondolas.map((g, i): Mover => ({ kind: 'gondola', ref: i, w: g.w * SUB, h: GONDOLA_H })),
    ...data.lifts.map((l, i): Mover => ({ kind: 'lift', ref: i, w: l.w * SUB, h: LIFT_H })),
    ...data.pulleys.flatMap((p, i): Mover[] => [
      { kind: 'pulleyA', ref: i, w: p.w * SUB, h: PULLEY_H },
      { kind: 'pulleyB', ref: i, w: p.w * SUB, h: PULLEY_H },
    ]),
  ];
  return {
    data, cols, rows, tiles,
    spawns: [sp(data.spawns.zharok), sp(data.spawns.khvylka)],
    checkpoints: data.checkpoints.map(sp),
    items: data.items.map((i) => ({ kind: i.kind, x: i.x * SUB, y: i.y * SUB })),
    plates: data.plates.map((p) => ({ x: p.x * SUB, y: p.y * SUB, w: p.w * SUB })),
    gates: data.gates.map((g) => ({ x: g.x * SUB, top: g.top * SUB, h: g.h * SUB, plates: g.plates, levers: g.levers })),
    lilies: data.lilies.map(sp),
    levers: data.levers.map((v) => ({ x: v.x * SUB, y: v.y * SUB, on: v.on })),
    lifts: data.lifts.map((l) => ({ x: l.x * SUB, w: l.w * SUB, y0: l.y0 * SUB, y1: l.y1 * SUB, plates: l.plates, levers: l.levers })),
    pulleys: data.pulleys.map((p) => ({ a: sp(p.a), b: sp(p.b), w: p.w * SUB, da: p.da * SUB, db: p.db * SUB })),
    tides: data.tides.map((t) => ({ x0: t.x0 * SUB, x1: t.x1 * SUB, bottom: t.bottom * SUB, low: t.low * SUB, high: t.high * SUB, period: t.period, phase: t.phase })),
    gondolas: data.gondolas.map((g) => ({ tide: g.tide, x0: g.x0 * SUB, x1: g.x1 * SUB, w: g.w * SUB, travel: g.travel, wait: g.wait, phase: g.phase })),
    movers,
    doors: [sp(data.doors.zharok), sp(data.doors.khvylka)],
    gemTotal: data.items.filter((i) => i.kind !== 'heart').length,
  };
}

// За межами карти — суцільний камінь
export function tileAt(L: Level, c: number, r: number): Tile {
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return Tile.Solid;
  return L.tiles[r * L.cols + c] as Tile;
}

// mover — індекс рухомої платформи або -1
export interface Rect { x: number; y: number; w: number; h: number; oneWay: boolean; mover: number }

// Прямокутник зіткнення тайла або null, якщо тайл прохідний
export function tileRect(t: Tile, c: number, r: number): Rect | null {
  const x = c * TILE, y = r * TILE;
  if (t === Tile.Solid) return { x, y, w: TILE, h: TILE, oneWay: false, mover: -1 };
  if (isLiquid(t)) return { x, y: y + POOL_INSET, w: TILE, h: TILE - POOL_INSET, oneWay: false, mover: -1 };
  if (t === Tile.OneWay) return { x, y, w: TILE, h: ONE_WAY_H, oneWay: true, mover: -1 };
  return null;
}
