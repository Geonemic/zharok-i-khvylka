import { describe, expect, it } from 'vitest';
import { findLevel } from '@zh/levels';
import {
  compileLevel, createState, placeChar, step, tideLevel, gondolaX,
  SUB, CHAR_W, CHAR_H, IN_LEFT, IN_RIGHT, IN_JUMP, IN_LINK, type Level, type SimState, type SimEvent,
} from '../src';

const IT = compileLevel(findLevel('it-1')!);
const FR = compileLevel(findLevel('fr-1')!);

const run = (s: SimState, L: Level, n: number, a = 0, b = 0, ev: SimEvent[] = []) => { for (let i = 0; i < n; i++) step(s, L, [a, b], ev); return ev; };
const put = (s: SimState, who: number, x: number, y: number) => placeChar(s.chars[who], { x: x * SUB, y: y * SUB });
const mid = (s: SimState, who: number) => (s.chars[who].x + CHAR_W / 2) / SUB;
const feet = (s: SimState, who: number) => (s.chars[who].y + CHAR_H) / SUB;
// Прибирає героя кудись убік, щоб не заважав
const park = (s: SimState, who: number) => put(s, who, who ? 160 : 60, 560);

// Веде героя до x (решта — без натискань). Повертає кількість кроків.
function walkTo(s: SimState, L: Level, who: number, x: number, max = 400): number {
  for (let i = 0; i < max; i++) {
    const d = x - mid(s, who);
    if (Math.abs(d) < 3) { run(s, L, 8); return i; }
    const inp = d > 0 ? IN_RIGHT : IN_LEFT;
    step(s, L, who ? [0, inp] : [inp, 0]);
  }
  throw new Error(`герой ${who} не дійшов до ${x}, стоїть на ${mid(s, who)}`);
}

describe('Італія: приплив і гондола', () => {
  it('приплив піднімається й спадає плавно, гондола стоїть на кінцях', () => {
    expect(tideLevel(IT, 0, 0)).toBe(680 * SUB);
    expect(tideLevel(IT, 0, 420)).toBe(572 * SUB);
    expect(tideLevel(IT, 0, 840)).toBe(680 * SUB);
    expect(gondolaX(IT, 0, 60)).toBe(424 * SUB);
    expect(gondolaX(IT, 0, 480)).toBe(816 * SUB);
    for (let t = 1; t < 840; t++) expect(Math.abs(tideLevel(IT, 0, t) - tideLevel(IT, 0, t - 1))).toBeLessThan(SUB);
  });

  it('на дні каналу у відплив Жарок живий, а в приплив гасне; Хвильці вода не шкодить', () => {
    const s = createState(IT);
    put(s, 0, 600, 680); put(s, 1, 650, 680);
    run(s, IT, 40);
    expect(s.chars[0].alive).toBe(true);
    const ev = run(s, IT, 200);
    expect(ev.some((e) => e.type === 'die' && e.who === 0 && e.kind === 'extinguish')).toBe(true);
    expect(ev.some((e) => e.type === 'die' && e.who === 1)).toBe(false);
  });

  it('гондола перевозить Жарка через канал у приплив', () => {
    const s = createState(IT);
    put(s, 0, 430, 672); park(s, 1);
    run(s, IT, 430);
    expect(s.chars[0].alive).toBe(true);
    expect(s.chars[0].onMover).toBe(0);
    expect(mid(s, 0)).toBeGreaterThan(800);
    // у приплив гондола врівень із набережною — можна зійти праворуч
    walkTo(s, IT, 0, 920);
    expect(feet(s, 0)).toBe(560);
    expect(s.chars[0].alive).toBe(true);
  });

  it('у гондолу можна застрибнути з набережної, поки вона відпливає', () => {
    const s = createState(IT);
    park(s, 1);
    walkTo(s, IT, 0, 300);
    run(s, IT, 22, IN_RIGHT | IN_JUMP);
    run(s, IT, 30);
    expect(s.chars[0].onMover).toBe(0);
  });

  it('Хвилька тримає плиту під водою — ворота відчиняються, Жарок проходить', () => {
    const s = createState(IT);
    run(s, IT, 640); // гондола вже відпливла від правого берега й не заважає
    put(s, 1, 796, 680); put(s, 0, 960, 560);
    run(s, IT, 30);
    expect(s.plates[0]).toBe(true);
    expect(s.gates[0]).toBe(1000);
    walkTo(s, IT, 0, 1168);
    expect(s.plates[1]).toBe(true);
    // Хвилька сходить із плити, виходить сходинкою з каналу й проходить ворота
    walkTo(s, IT, 1, 822);
    run(s, IT, 14, 0, IN_RIGHT | IN_JUMP);
    run(s, IT, 30);
    expect(feet(s, 1)).toBe(640);
    run(s, IT, 16, 0, IN_RIGHT | IN_JUMP);
    run(s, IT, 30);
    expect(feet(s, 1)).toBe(560);
    walkTo(s, IT, 1, 1100);
    expect(s.chars[1].alive).toBe(true);
  });

  it('сердечко над каналом дістають лише удвох, стрибнувши з гондоли', () => {
    const tryJump = (linked: boolean, at: number) => {
      const s = createState(IT);
      put(s, 0, 412, 672); put(s, 1, 436, 672);
      run(s, IT, 2);
      if (linked) run(s, IT, 1, IN_LINK, 0);
      while (s.tick < at) run(s, IT, 1);
      if (s.chars[0].onMover !== 0 || s.chars[1].onMover !== 0) throw new Error('герої мали стояти в гондолі');
      run(s, IT, 40, IN_JUMP, IN_JUMP);
      return s.taken[6];
    };
    const ticks = Array.from({ length: 30 }, (_, i) => 230 + i * 3);
    expect(ticks.some((t) => tryJump(true, t))).toBe(true);
    expect(ticks.some((t) => tryJump(false, t))).toBe(false);
  });
});

describe('Франція: важелі, ліфти, противага', () => {
  it('важіль вмикається, коли крізь нього пройти праворуч, і вимикається ліворуч', () => {
    const s = createState(FR);
    put(s, 0, 1060, 360); put(s, 1, 960, 360);
    const ev = run(s, FR, 1);
    walkTo(s, FR, 0, 1130);
    expect(s.levers[0]).toBe(true);
    walkTo(s, FR, 0, 1070);
    expect(s.levers[0]).toBe(false);
    run(s, FR, 1, 0, 0, ev);
    walkTo(s, FR, 0, 1140);
    expect(s.levers[0]).toBe(true);
  });

  it('ліфт за важелем піднімає героя з нижнього даху на середній', () => {
    const s = createState(FR);
    put(s, 1, 1200, 600); put(s, 0, 1060, 360);
    run(s, FR, 4);
    walkTo(s, FR, 0, 1130);
    run(s, FR, 140);
    expect(feet(s, 1)).toBe(360);
    expect(s.chars[1].onMover).toBe(0);
    walkTo(s, FR, 1, 1100);
    expect(feet(s, 1)).toBe(360);
  });

  it('противага: хто стоїть на важкій платформі, той піднімає партнера', () => {
    const s = createState(FR);
    put(s, 1, 920, 600); put(s, 0, 1040, 600);
    run(s, FR, 150);
    expect(s.pulleys[0]).toBe(1000);
    expect(feet(s, 1)).toBe(360);
    expect(feet(s, 0)).toBe(640);
    walkTo(s, FR, 1, 1000);
    expect(feet(s, 1)).toBe(360);
    // важку платформу відпустили — вона повертається, а друга опускається
    run(s, FR, 14, IN_LEFT | IN_JUMP, 0);
    run(s, FR, 160);
    expect(s.pulleys[0]).toBe(0);
  });

  it('сам собі противагою не піднімешся: без партнера друга платформа їде порожня', () => {
    const s = createState(FR);
    put(s, 0, 1040, 600); park(s, 1);
    run(s, FR, 150);
    expect(s.pulleys[0]).toBe(1000);
    expect(feet(s, 0)).toBe(640);
  });

  it('ліфт над трясовиною: плита або важіль на другому кінці', () => {
    const s = createState(FR);
    put(s, 0, 360, 360); put(s, 1, 460, 360);
    run(s, FR, 120);
    expect(s.plates[0]).toBe(true);
    expect(feet(s, 0)).toBe(160);
    walkTo(s, FR, 0, 120);
    expect(s.levers[1]).toBe(false);
    // Хвилька сходить із плити — ліфт спускається; вона стає на нього, Жарок вмикає важіль
    walkTo(s, FR, 1, 400);
    run(s, FR, 110);
    walkTo(s, FR, 1, 360);
    expect(feet(s, 1)).toBe(360);
    walkTo(s, FR, 0, 180);
    expect(s.levers[1]).toBe(true);
    run(s, FR, 120);
    expect(feet(s, 1)).toBe(160);
  });

  it('сердечко на середньому даху — лише стрибком удвох', () => {
    const tryJump = (linked: boolean) => {
      const s = createState(FR);
      put(s, 0, 996, 360); put(s, 1, 1024, 360);
      run(s, FR, 3);
      if (linked) run(s, FR, 1, IN_LINK, 0);
      run(s, FR, 2);
      run(s, FR, 45, IN_JUMP, IN_JUMP);
      return s.taken[6];
    };
    expect(tryJump(false)).toBe(false);
    expect(tryJump(true)).toBe(true);
  });

  it('ворота перед дверима: тримає плита, а важіль за ними лишає їх відчиненими', () => {
    const s = createState(FR);
    put(s, 1, 900, 160); put(s, 0, 960, 160);
    run(s, FR, 40);
    expect(s.gates[0]).toBe(1000);
    walkTo(s, FR, 0, 1150);
    expect(s.levers[2]).toBe(true);
    walkTo(s, FR, 1, 1205);
    expect(s.won).toBe(true);
  });
});

// ===== Чи можна пройти рівні: кожен стрибок маршруту окремо =====
const PARK: Record<string, [number, number][]> = { 'it-1': [[60, 560], [160, 560]], 'fr-1': [[80, 600], [130, 600]] };

// Герой біжить у бік dir і стрибає, коли його середина досягне jx; після приземлення відпускає клавіші.
// Повертає, чи існує таке jx у проміжку, щоб він живим опинився на висоті landY за позначкою beyond.
function cross(L: Level, who: number, x: number, y: number, dir: 1 | -1, jxFrom: number, jxTo: number, landY: number, beyond: number): boolean {
  for (let jx = jxFrom; (jx - jxTo) * dir <= 0; jx += 3 * dir) {
    const s = createState(L), [px, py] = PARK[L.data.id][1 - who];
    put(s, who, x, y); put(s, 1 - who, px, py);
    run(s, L, 3);
    let hold = -1;
    for (let t = 0; t < 300; t++) {
      if (hold < 0 && (mid(s, who) - jx) * dir >= 0) hold = 16;
      const inp = (hold === 0 && s.chars[who].grounded ? 0 : dir > 0 ? IN_RIGHT : IN_LEFT) | (hold > 0 ? IN_JUMP : 0);
      step(s, L, who ? [0, inp] : [inp, 0]);
      if (hold > 0) hold--;
      if (!s.chars[who].alive || (hold === 0 && s.chars[who].grounded)) break;
    }
    run(s, L, 20);
    if (s.chars[who].alive && feet(s, who) === landY && (mid(s, who) - beyond) * dir >= 0) return true;
  }
  return false;
}

describe('маршрут «Венеційських каналів» прохідний', () => {
  it('шахта праворуч: дві полиці й середній ярус', () => {
    expect(cross(IT, 0, 1100, 560, 1, 1110, 1170, 480, 1165)).toBe(true);
    expect(cross(IT, 0, 1230, 480, -1, 1230, 1170, 400, 1195)).toBe(true);
    expect(cross(IT, 0, 1180, 400, -1, 1180, 1120, 360, 1085)).toBe(true);
  });
  it('середній ярус: Хвилька над жаром, Жарок над водою', () => {
    expect(cross(IT, 1, 1110, 360, -1, 1065, 1030, 360, 915)).toBe(true);
    expect(cross(IT, 0, 710, 360, -1, 665, 630, 360, 555)).toBe(true);
  });
  it('підйом ліворуч на верхній ярус', () => {
    expect(cross(IT, 0, 280, 360, -1, 250, 170, 280, 150)).toBe(true);
    expect(cross(IT, 1, 90, 280, 1, 100, 165, 200, 210)).toBe(true);
    expect(cross(IT, 0, 220, 200, 1, 225, 285, 160, 335)).toBe(true);
  });
  it('верхній ярус: жар, вода, трясовина', () => {
    expect(cross(IT, 1, 330, 160, 1, 400, 445, 160, 573)).toBe(true);
    expect(cross(IT, 0, 580, 160, 1, 600, 645, 160, 773)).toBe(true);
    expect(cross(IT, 0, 770, 160, 1, 790, 845, 160, 933)).toBe(true);
    expect(cross(IT, 1, 770, 160, 1, 790, 845, 160, 933)).toBe(true);
  });
});

describe('маршрут «Дахів Парижа» прохідний', () => {
  it('нижній дах: комин, жар і вода з дошками над ними', () => {
    expect(cross(FR, 0, 150, 600, 1, 170, 235, 520, 245)).toBe(true); // на комин, далі просто зійти
    expect(cross(FR, 1, 340, 600, 1, 345, 400, 520, 445)).toBe(true);
    expect(cross(FR, 1, 450, 520, 1, 455, 520, 600, 573)).toBe(true);
    expect(cross(FR, 0, 580, 600, 1, 585, 640, 520, 685)).toBe(true);
    expect(cross(FR, 0, 690, 520, 1, 695, 760, 600, 813)).toBe(true);
  });
  it('середній дах: проліт противаги, жар і вода', () => {
    expect(cross(FR, 1, 1000, 360, -1, 995, 955, 360, 875)).toBe(true);
    expect(cross(FR, 1, 870, 360, -1, 860, 800, 360, 675)).toBe(true);
    expect(cross(FR, 0, 670, 360, -1, 660, 600, 360, 475)).toBe(true);
  });
  it('верхній дах: дошки під самим небом', () => {
    expect(cross(FR, 1, 410, 160, 1, 415, 480, 80, 525)).toBe(true);
    expect(cross(FR, 1, 530, 80, 1, 535, 600, 160, 653)).toBe(true);
    expect(cross(FR, 0, 690, 160, 1, 695, 750, 80, 765)).toBe(true);
    expect(cross(FR, 0, 770, 80, 1, 775, 840, 160, 893)).toBe(true);
  });
});
