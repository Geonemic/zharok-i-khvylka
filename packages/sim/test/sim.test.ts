import { describe, expect, it } from 'vitest';
import { findLevel } from '@zh/levels';
import {
  compileLevel, createState, cloneState, hashState, placeChar, step, rating,
  SUB, CHAR_H, IN_LEFT, IN_RIGHT, IN_JUMP, IN_LINK, type SimState, type SimEvent,
} from '../src';

const L = compileLevel(findLevel('ua-1')!);
const run = (s: SimState, n: number, a = 0, b = 0, ev: SimEvent[] = []) => { for (let i = 0; i < n; i++) step(s, L, [a, b], ev); return ev; };
const feet = (x: number, y: number) => ({ x: x * SUB, y: y * SUB });
const cx = (s: SimState, who: number) => Math.round((s.chars[who].x + 13 * SUB) / SUB);
const bottom = (s: SimState, who: number) => (s.chars[who].y + CHAR_H) / SUB;

// Псевдовипадкові натискання — однакові при однаковому зерні
function inputs(seed: number, n: number): [number, number][] {
  let a = seed;
  const r = () => { a = (Math.imul(a, 1103515245) + 12345) | 0; return (a >>> 16) & 0xff; };
  const out: [number, number][] = [];
  let cur: [number, number] = [0, 0];
  for (let i = 0; i < n; i++) { if (i % 9 === 0) cur = [r() & 15, r() & 15]; out.push(cur); }
  return out;
}

describe('детермінізм', () => {
  it('однакові натискання дають однаковий стан', () => {
    const seq = inputs(7, 1500);
    const a = createState(L), b = createState(L);
    for (const inp of seq) { step(a, L, inp); step(b, L, inp); }
    expect(hashState(a)).toBe(hashState(b));
    expect(a.tick).toBe(1500);
  });

  it('відкат до копії й повтор дають той самий результат (основа rollback)', () => {
    const seq = inputs(42, 1200);
    const s = createState(L);
    for (let i = 0; i < 600; i++) step(s, L, seq[i]);
    const snap = cloneState(s);
    for (let i = 600; i < 1200; i++) step(s, L, seq[i]);
    for (let i = 600; i < 1200; i++) step(snap, L, seq[i]);
    expect(hashState(snap)).toBe(hashState(s));
  });

  it('різні натискання дають різний стан', () => {
    const a = createState(L), b = createState(L);
    for (const inp of inputs(1, 300)) step(a, L, inp);
    for (const inp of inputs(2, 300)) step(b, L, inp);
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('стихії', () => {
  it('Жарок проходить жар і бере іскорку, Хвилька в жару випаровується', () => {
    const s = createState(L);
    run(s, 20);
    run(s, 60, IN_RIGHT, 0);
    expect(s.chars[0].alive).toBe(true);
    expect(s.taken[0]).toBe(true);
    const ev = run(s, 40, 0, IN_RIGHT);
    expect(ev.some((e) => e.type === 'die' && e.who === 1 && e.kind === 'evaporate')).toBe(true);
    run(s, 80);
    expect(s.chars[1].alive).toBe(true);
    expect(cx(s, 1)).toBe(140);
  });

  it('Жарок гасне у воді', () => {
    const s = createState(L);
    placeChar(s.chars[0], feet(500, 670));
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === 'die' && e.who === 0 && e.kind === 'extinguish')).toBe(true);
  });

  it('трясовина небезпечна для обох', () => {
    for (const who of [0, 1]) {
      const s = createState(L);
      placeChar(s.chars[who], feet(680, 670));
      const ev = run(s, 30);
      expect(ev.some((e) => e.type === 'die' && e.who === who && e.kind === 'sink')).toBe(true);
    }
  });

  it('латаття тримає Жарка над водою', () => {
    const s = createState(L);
    placeChar(s.chars[0], feet(780, 470));
    run(s, 40);
    expect(s.chars[0].alive).toBe(true);
    expect(s.chars[0].onMover).toBe(2);
  });
});

describe('ворота', () => {
  const upstairs = () => { const s = createState(L); s.checkpoint = 1; return s; };

  it('один гравець не може сам відкрити ворота й проскочити', () => {
    const s = upstairs();
    placeChar(s.chars[0], feet(420, 270)); placeChar(s.chars[1], feet(200, 270));
    run(s, 40);
    expect(s.gates[0]).toBe(1000);
    run(s, 90, IN_RIGHT, 0);
    expect(s.chars[0].x).toBeLessThanOrEqual((580 - 11 - 26) * SUB);
    expect(s.gates[0]).toBe(0);
  });

  it('того, хто стоїть під воротами, виштовхує на його бік', () => {
    const s = upstairs();
    placeChar(s.chars[0], feet(420, 270)); placeChar(s.chars[1], feet(576, 270));
    run(s, 40);
    placeChar(s.chars[0], feet(300, 270));
    run(s, 30);
    expect(s.gates[0]).toBe(0);
    expect(cx(s, 1)).toBeLessThan(570);
  });

  it('удвох проходять: один тримає плиту, інший проходить і тримає другу', () => {
    const s = upstairs();
    placeChar(s.chars[0], feet(420, 270)); placeChar(s.chars[1], feet(480, 270));
    run(s, 40);
    for (let i = 0; i < 150 && cx(s, 1) < 700; i++) run(s, 1, 0, IN_RIGHT);
    run(s, 20);
    expect(s.plates[1]).toBe(true);
    run(s, 70, IN_RIGHT, 0);
    expect(cx(s, 0)).toBeGreaterThan(591);
  });
});

describe('тримання за руки', () => {
  it('удвох стрибають вище й дістають серце', () => {
    const s = createState(L); s.checkpoint = 1;
    placeChar(s.chars[0], feet(940, 270)); placeChar(s.chars[1], feet(980, 270));
    run(s, 20);
    run(s, 1, IN_LINK, 0);
    expect(s.linked).toBe(true);
    run(s, 1, IN_JUMP, 0);
    run(s, 60);
    expect(s.taken[6]).toBe(true);
    expect(bottom(s, 0)).toBe(120);
    expect(bottom(s, 1)).toBe(120);
  });

  it('далеко одне від одного взятися за руки не можна', () => {
    const s = createState(L);
    run(s, 10);
    placeChar(s.chars[1], feet(400, 670));
    run(s, 10);
    const ev = run(s, 1, IN_LINK, 0);
    expect(s.linked).toBe(false);
    expect(ev.some((e) => e.type === 'tooFar')).toBe(true);
  });
});

describe('фініш', () => {
  it('перемога лише коли обидва стоять кожен біля своїх дверей', () => {
    const s = createState(L); s.checkpoint = 1;
    placeChar(s.chars[0], feet(1180, 270)); placeChar(s.chars[1], feet(1090, 270));
    run(s, 30);
    expect(s.won).toBe(false);
    placeChar(s.chars[0], feet(1090, 270)); placeChar(s.chars[1], feet(1180, 270));
    run(s, 30);
    expect(s.won).toBe(true);
    const x = s.chars[0].x;
    run(s, 30, IN_LEFT, IN_RIGHT);
    expect(s.chars[0].x).toBe(x);
  });

  it('оцінка: зірки за скарби, діамантова — за сердечко', () => {
    const s = createState(L);
    expect(rating(s, L)).toMatchObject({ stars: 1, diamond: false });
    s.taken = [true, true, true, false, false, false, false];
    expect(rating(s, L).stars).toBe(2);
    s.taken = [true, true, true, true, true, true, true];
    expect(rating(s, L)).toMatchObject({ stars: 3, diamond: true });
  });
});
