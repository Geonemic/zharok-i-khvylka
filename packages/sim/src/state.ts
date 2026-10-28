import { CHAR_W, CHAR_H } from './constants';
import type { Level, Pt } from './level';
import { placeMovers, signal } from './movers';

export type DeathKind = 'extinguish' | 'evaporate' | 'sink';
export const ZHAROK = 0;
export const KHVYLKA = 1;

export interface CharState {
  x: number; // лівий верхній кут, підпікселі
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  onMover: number; // індекс рухомої платформи під ногами або -1
  coyote: number;
  jumpBuf: number;
  linkJump: boolean;
  airT: number;
  facing: 1 | -1;
  alive: boolean;
  deathT: number;
  deathKind: DeathKind | null;
  deathSurf: number;
}

export interface SimState {
  tick: number;
  chars: [CharState, CharState]; // 0 — Жарок, 1 — Хвилька
  prevInput: [number, number];
  taken: boolean[];
  plates: boolean[];
  gates: number[]; // відчиненість 0…1000
  levers: boolean[];
  lifts: number[]; // хід ліфта від y0, підпікселі
  pulleys: number[]; // хід противаги 0…1000
  lilySink: number[];
  // рухомі платформи (див. Level.movers): середина, верх і зсув за останній крок
  mvX: number[];
  mvY: number[];
  mvDx: number[];
  mvDy: number[];
  checkpoint: number; // -1 — ще на старті
  linked: boolean;
  won: boolean;
  winTick: number;
}

export function newChar(): CharState {
  return {
    x: 0, y: 0, vx: 0, vy: 0, grounded: false, onMover: -1, coyote: 0, jumpBuf: 0, linkJump: false, airT: 0,
    facing: 1, alive: true, deathT: 0, deathKind: null, deathSurf: 0,
  };
}

// Ставить героя так, щоб середина його ніг була в точці feet
export function placeChar(ch: CharState, feet: Pt): void {
  ch.x = feet.x - CHAR_W / 2;
  ch.y = feet.y - CHAR_H;
  ch.vx = 0; ch.vy = 0;
  ch.grounded = false; ch.onMover = -1;
}

export function createState(L: Level): SimState {
  const chars: [CharState, CharState] = [newChar(), newChar()];
  placeChar(chars[0], L.spawns[0]);
  placeChar(chars[1], L.spawns[1]);
  const s: SimState = {
    tick: 0,
    chars,
    prevInput: [0, 0],
    taken: L.items.map(() => false),
    plates: L.plates.map(() => false),
    gates: [],
    levers: L.levers.map((v) => v.on),
    lifts: [],
    pulleys: L.pulleys.map(() => 0),
    lilySink: L.lilies.map(() => 0),
    mvX: L.movers.map(() => 0),
    mvY: L.movers.map(() => 0),
    mvDx: L.movers.map(() => 0),
    mvDy: L.movers.map(() => 0),
    checkpoint: -1,
    linked: false,
    won: false,
    winTick: 0,
  };
  // важіль, увімкнений від початку, одразу тримає свої ворота й ліфти ввімкненими
  s.gates = L.gates.map((g) => (signal(s, g) ? 1000 : 0));
  s.lifts = L.lifts.map((l) => (signal(s, l) ? Math.abs(l.y1 - l.y0) : 0));
  placeMovers(s, L, false);
  return s;
}

// Глибока копія — для rollback-неткоду й повторів
export function cloneState(s: SimState): SimState {
  return {
    ...s,
    chars: [{ ...s.chars[0] }, { ...s.chars[1] }],
    prevInput: [s.prevInput[0], s.prevInput[1]],
    taken: s.taken.slice(),
    plates: s.plates.slice(),
    gates: s.gates.slice(),
    levers: s.levers.slice(),
    lifts: s.lifts.slice(),
    pulleys: s.pulleys.slice(),
    lilySink: s.lilySink.slice(),
    mvX: s.mvX.slice(),
    mvY: s.mvY.slice(),
    mvDx: s.mvDx.slice(),
    mvDy: s.mvDy.slice(),
  };
}

// Відбиток стану: якщо в двох гравців він різний — симуляції розійшлися
export function hashState(s: SimState): number {
  let h = 2166136261;
  const mix = (v: number) => {
    const n = v | 0;
    h = Math.imul(h ^ (n & 0xffff), 16777619);
    h = Math.imul(h ^ ((n >>> 16) & 0xffff), 16777619);
  };
  mix(s.tick); mix(s.checkpoint); mix(+s.linked); mix(+s.won); mix(s.winTick);
  for (const c of s.chars) {
    mix(c.x); mix(c.y); mix(c.vx); mix(c.vy); mix(+c.grounded); mix(c.onMover); mix(c.coyote); mix(c.jumpBuf);
    mix(+c.linkJump); mix(c.facing); mix(+c.alive); mix(c.deathT);
  }
  for (const v of s.taken) mix(+v);
  for (const v of s.plates) mix(+v);
  for (const v of s.gates) mix(v);
  for (const v of s.levers) mix(+v);
  for (const v of s.lifts) mix(v);
  for (const v of s.pulleys) mix(v);
  for (const v of s.lilySink) mix(v);
  for (const v of s.mvX) mix(v);
  for (const v of s.mvY) mix(v);
  mix(s.prevInput[0]); mix(s.prevInput[1]);
  return h >>> 0;
}
