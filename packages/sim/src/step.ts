import {
  SUB, TILE, CHAR_W, CHAR_H, GRAV, GRAV_SHORT_JUMP, MAX_FALL, RUN_SPEED, ACC_GROUND, ACC_AIR, JUMP_SPEED,
  LINK_BOOST_NUM, LINK_BOOST_DEN, COYOTE_TICKS, JUMP_BUFFER_TICKS, HAZARD_DEPTH, STEP_UP, DEATH_TICKS,
  LINK_NEAR_X, LINK_NEAR_Y, LINK_BREAK, GATE_W, GATE_OPEN_STEP, GATE_CLOSE_STEP, PLATE_MIN_OVERLAP,
  LILY_SINK, ITEM_RADIUS, DOOR_REACH, IN_LEFT, IN_RIGHT, IN_JUMP, IN_LINK, LEVER_REACH, LIFT_SPEED, PULLEY_STEP,
} from './constants';
import { Tile, isLiquid, tileAt, tileRect, type Level, type Rect } from './level';
import { placeChar, type CharState, type DeathKind, type SimState } from './state';
import { placeMovers, signal, tideLevel } from './movers';

export { wave, ease, tideLevel, gondolaX, signal } from './movers';

export type SimEvent =
  | { type: 'jump'; who: number; linked: boolean }
  | { type: 'land'; who: number; impact: number }
  | { type: 'die'; who: number; kind: DeathKind; surface: number }
  | { type: 'respawn'; who: number }
  | { type: 'collect'; index: number }
  | { type: 'link' }
  | { type: 'unlink' }
  | { type: 'tooFar' }
  | { type: 'gateShut'; index: number }
  | { type: 'lever'; index: number; on: boolean }
  | { type: 'checkpoint'; index: number }
  | { type: 'win' };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const overlaps = (a: { x: number; y: number }, aw: number, ah: number, b: Rect) =>
  a.x < b.x + b.w && a.x + aw > b.x && a.y < b.y + b.h && a.y + ah > b.y;

export function gateRect(L: Level, k: number, open: number): Rect | null {
  const g = L.gates[k], h = Math.trunc((g.h * (1000 - open)) / 1000);
  return h > SUB / 2 ? { x: g.x - GATE_W / 2, y: g.top, w: GATE_W, h, oneWay: false, mover: -1 } : null;
}

// ===== Зіткнення =====
const solids: Rect[] = [];
function gather(s: SimState, L: Level, x0: number, y0: number, x1: number, y1: number): void {
  solids.length = 0;
  const c1 = Math.floor(x1 / TILE), r1 = Math.floor(y1 / TILE);
  for (let r = Math.floor(y0 / TILE); r <= r1; r++) {
    for (let c = Math.floor(x0 / TILE); c <= c1; c++) {
      const rect = tileRect(tileAt(L, c, r), c, r);
      if (rect) solids.push(rect);
    }
  }
  for (let k = 0; k < L.gates.length; k++) { const g = gateRect(L, k, s.gates[k]); if (g) solids.push(g); }
  for (let k = 0; k < L.movers.length; k++) {
    const m = L.movers[k];
    solids.push({ x: s.mvX[k] - m.w / 2, y: s.mvY[k], w: m.w, h: m.h, oneWay: true, mover: k });
  }
}
function hitsAny(x: number, y: number): boolean {
  for (const r of solids) if (!r.oneWay && overlaps({ x, y }, CHAR_W, CHAR_H, r)) return true;
  return false;
}

// cx, cy — на скільки зсунулася за крок платформа під ногами (вона везе героя)
function moveChar(s: SimState, L: Level, ch: CharState, cx: number, cy: number): void {
  const m = 16 * SUB + Math.abs(ch.vx) + Math.abs(ch.vy) + Math.abs(cx) + Math.abs(cy);
  gather(s, L, ch.x - m, ch.y - m, ch.x + CHAR_W + m, ch.y + CHAR_H + m);
  if (cy && !hitsAny(ch.x, ch.y + cy)) ch.y += cy; // під стелею платформа проходить крізь ноги, а не тисне
  ch.x += ch.vx + cx;
  for (const r of solids) {
    if (r.oneWay || !overlaps(ch, CHAR_W, CHAR_H, r)) continue;
    const rise = ch.y + CHAR_H - r.y;
    // невеликі сходинки (край басейну) переступаємо автоматично
    if (ch.grounded && rise > 0 && rise <= STEP_UP && !hitsAny(ch.x, r.y - CHAR_H)) { ch.y = r.y - CHAR_H; continue; }
    ch.x = ch.x + CHAR_W / 2 < r.x + r.w / 2 ? r.x - CHAR_W : r.x + r.w;
    ch.vx = 0;
  }
  const prevBottom = ch.y + CHAR_H;
  ch.y += ch.vy;
  ch.grounded = false;
  ch.onMover = -1;
  for (const r of solids) {
    if (!overlaps(ch, CHAR_W, CHAR_H, r)) continue;
    if (r.oneWay) {
      // рухома платформа могла за крок піднятися назустріч ногам — це теж приземлення
      if (ch.vy >= 0 && prevBottom <= r.y + (r.mover >= 0 ? 4 * SUB + Math.abs(s.mvDy[r.mover]) : 0)) {
        ch.y = r.y - CHAR_H; ch.vy = 0; ch.grounded = true; ch.onMover = r.mover;
      }
      continue;
    }
    if (ch.vy > 0) { ch.y = r.y - CHAR_H; ch.vy = 0; ch.grounded = true; ch.onMover = -1; }
    else { ch.y = r.y + r.h; ch.vy = 0; }
  }
  // платформа врівень із підлогою (ліфт унизу, противага на дні): стоїмо саме на ній, щоб вона везла
  if (ch.grounded && ch.onMover < 0) {
    for (const r of solids) {
      if (r.mover >= 0 && r.y === ch.y + CHAR_H && ch.x < r.x + r.w && ch.x + CHAR_W > r.x) { ch.onMover = r.mover; break; }
    }
  }
}

// ===== Герої =====
function jump(s: SimState, who: number, ev: SimEvent[]): void {
  const ch = s.chars[who];
  ch.vy = s.linked ? -Math.trunc((JUMP_SPEED * LINK_BOOST_NUM) / LINK_BOOST_DEN) : -JUMP_SPEED;
  ch.jumpBuf = 0; ch.coyote = 0; ch.grounded = false; ch.onMover = -1; ch.linkJump = s.linked;
  ev.push({ type: 'jump', who, linked: s.linked });
}

function kill(s: SimState, who: number, liquid: Tile, surface: number, ev: SimEvent[]): void {
  const ch = s.chars[who];
  ch.alive = false; ch.deathT = DEATH_TICKS; ch.deathSurf = surface; ch.vx = 0; ch.vy = 0;
  ch.deathKind = liquid === Tile.Bog ? 'sink' : who === 0 ? 'extinguish' : 'evaporate';
  ev.push({ type: 'die', who, kind: ch.deathKind, surface });
  s.linked = false;
}

function respawn(s: SimState, L: Level, who: number, ev: SimEvent[]): void {
  const ch = s.chars[who];
  if (s.checkpoint >= 0) {
    const cp = L.checkpoints[s.checkpoint];
    placeChar(ch, { x: cp.x + (who === 0 ? -20 : 20) * SUB, y: cp.y });
  } else placeChar(ch, L.spawns[who]);
  ch.alive = true; ch.deathKind = null; ch.coyote = 0; ch.jumpBuf = 0; ch.linkJump = false;
  ev.push({ type: 'respawn', who });
}

function checkHazard(s: SimState, L: Level, who: number, ev: SimEvent[]): void {
  const ch = s.chars[who], bottom = ch.y + CHAR_H, r = Math.floor((bottom - 1) / TILE);
  const c1 = Math.floor((ch.x + CHAR_W - 4 * SUB) / TILE);
  for (let c = Math.floor((ch.x + 4 * SUB) / TILE); c <= c1; c++) {
    const t = tileAt(L, c, r);
    if (!isLiquid(t) || bottom < r * TILE + HAZARD_DEPTH) continue;
    if (t === Tile.Bog || (t === Tile.Water && who === 0) || (t === Tile.Fire && who === 1)) { kill(s, who, t, r * TILE + 8 * SUB, ev); return; }
  }
  if (who !== 0) return;
  // глибока вода припливу гасить Жарка; Хвилька в ній як удома
  const mid = ch.x + CHAR_W / 2;
  for (let k = 0; k < L.tides.length; k++) {
    const td = L.tides[k], surf = tideLevel(L, k, s.tick);
    if (mid >= td.x0 && mid < td.x1 && ch.y < td.bottom && bottom >= surf + HAZARD_DEPTH) { kill(s, who, Tile.Water, surf, ev); return; }
  }
}

function updateChar(s: SimState, L: Level, who: number, input: number, pressed: number, ev: SimEvent[]): void {
  const ch = s.chars[who];
  if (!ch.alive) { if (--ch.deathT <= 0) respawn(s, L, who, ev); return; }
  const dir = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
  if (dir) ch.facing = dir as 1 | -1;
  const acc = ch.grounded ? ACC_GROUND : ACC_AIR;
  ch.vx += clamp(dir * RUN_SPEED - ch.vx, -acc, acc);
  if (pressed & IN_JUMP) ch.jumpBuf = JUMP_BUFFER_TICKS; else if (ch.jumpBuf > 0) ch.jumpBuf--;
  if (ch.grounded) ch.coyote = COYOTE_TICKS; else if (ch.coyote > 0) ch.coyote--;
  if (ch.jumpBuf > 0 && ch.coyote > 0) {
    jump(s, who, ev);
    // тримаючись за руки, стрибають разом
    const o = s.chars[1 - who];
    if (s.linked && o.alive && o.coyote > 0 && o.vy >= 0) jump(s, 1 - who, ev);
  }
  ch.vy += GRAV;
  if (ch.vy < 0 && !(input & IN_JUMP) && !ch.linkJump) ch.vy += GRAV_SHORT_JUMP; // коротке натискання — нижчий стрибок
  if (ch.vy >= 0) ch.linkJump = false;
  if (ch.vy > MAX_FALL) ch.vy = MAX_FALL;
  const k = ch.onMover;
  const wasGrounded = ch.grounded, fallV = ch.vy;
  moveChar(s, L, ch, k >= 0 ? s.mvDx[k] : 0, k >= 0 ? s.mvDy[k] : 0);
  if (ch.grounded && !wasGrounded) ev.push({ type: 'land', who, impact: fallV });
  ch.airT = ch.grounded ? 0 : ch.airT + 1;
  checkHazard(s, L, who, ev);
}

function updateLink(s: SimState, pressed: [number, number], ev: SimEvent[]): void {
  const [a, b] = s.chars;
  if (!a.alive || !b.alive || s.won) { s.linked = false; return; }
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((pressed[0] | pressed[1]) & IN_LINK) {
    if (s.linked) { s.linked = false; ev.push({ type: 'unlink' }); }
    else if (Math.abs(dx) < LINK_NEAR_X && Math.abs(dy) < LINK_NEAR_Y) { s.linked = true; ev.push({ type: 'link' }); }
    else ev.push({ type: 'tooFar' });
  }
  if (s.linked && dx * dx + dy * dy > LINK_BREAK * LINK_BREAK) { s.linked = false; ev.push({ type: 'unlink' }); }
}

// Ворота не чекають на героя: того, хто під ними, виштовхують на його бік
function pushOut(s: SimState, L: Level, ch: CharState, r: Rect): boolean {
  gather(s, L, r.x - 60 * SUB, ch.y - 10 * SUB, r.x + r.w + 60 * SUB, ch.y + CHAR_H + 10 * SUB);
  const left = r.x - CHAR_W, right = r.x + r.w;
  for (const x of ch.x + CHAR_W / 2 < r.x + r.w / 2 ? [left, right] : [right, left]) {
    if (hitsAny(x, ch.y)) continue;
    ch.x = x; ch.vx = 0;
    return true;
  }
  return false;
}

function updateWorld(s: SimState, L: Level, ev: SimEvent[]): void {
  const chars = s.chars;
  L.plates.forEach((p, k) => {
    s.plates[k] = chars.some((c) => c.alive && c.grounded && Math.abs(c.y + CHAR_H - p.y) < 2 * SUB &&
      Math.min(c.x + CHAR_W, p.x + p.w) - Math.max(c.x, p.x) >= PLATE_MIN_OVERLAP);
  });
  // важіль перехиляється туди, куди крізь нього пройшли: праворуч — увімкнено, ліворуч — вимкнено
  L.levers.forEach((v, k) => {
    for (const c of chars) {
      if (!c.alive || !c.grounded || Math.abs(c.x + CHAR_W / 2 - v.x) >= LEVER_REACH || Math.abs(c.y + CHAR_H - v.y) >= 4 * SUB) continue;
      const on = c.vx > SUB / 4 ? true : c.vx < -SUB / 4 ? false : s.levers[k];
      if (on !== s.levers[k]) { s.levers[k] = on; ev.push({ type: 'lever', index: k, on }); }
    }
  });
  L.gates.forEach((g, k) => {
    if (signal(s, g)) { s.gates[k] = Math.min(1000, s.gates[k] + GATE_OPEN_STEP); return; }
    if (s.gates[k] === 0) return;
    const next = Math.max(0, s.gates[k] - GATE_CLOSE_STEP), r = gateRect(L, k, next);
    if (!r || chars.every((c) => !c.alive || !overlaps(c, CHAR_W, CHAR_H, r) || pushOut(s, L, c, r))) {
      s.gates[k] = next;
      if (next === 0) ev.push({ type: 'gateShut', index: k });
    }
  });
  L.items.forEach((it, k) => {
    if (s.taken[k]) return;
    for (let who = 0; who < 2; who++) {
      const c = chars[who];
      if (!c.alive || (it.kind === 'spark' && who !== 0) || (it.kind === 'drop' && who !== 1)) continue;
      const dx = c.x + CHAR_W / 2 - it.x, dy = c.y + CHAR_H / 2 - it.y;
      if (dx * dx + dy * dy >= ITEM_RADIUS * ITEM_RADIUS) continue;
      s.taken[k] = true;
      ev.push({ type: 'collect', index: k });
      break;
    }
  });
  L.checkpoints.forEach((cp, k) => {
    if (k <= s.checkpoint) return;
    const flag: Rect = { x: cp.x - 12 * SUB, y: cp.y - 50 * SUB, w: 24 * SUB, h: 50 * SUB, oneWay: false, mover: -1 };
    if (chars.some((c) => c.alive && overlaps(c, CHAR_W, CHAR_H, flag))) { s.checkpoint = k; ev.push({ type: 'checkpoint', index: k }); }
  });
  if (!s.won) {
    const atDoor = (who: number) => {
      const c = chars[who], d = L.doors[who];
      return c.alive && c.grounded && Math.abs(c.x + CHAR_W / 2 - d.x) < DOOR_REACH && Math.abs(c.y + CHAR_H - d.y) < 3 * SUB;
    };
    if (atDoor(0) && atDoor(1)) { s.won = true; s.winTick = s.tick; ev.push({ type: 'win' }); }
  }
  // латаття погойдується й трохи тоне, коли на ньому стоять (латаття — перші в списку платформ)
  const riders = (m: number) => chars.some((c) => c.alive && c.onMover === m);
  L.lilies.forEach((_, k) => {
    s.lilySink[k] += clamp((riders(k) ? LILY_SINK : 0) - s.lilySink[k], -40, 40);
  });
  // ліфт їде до верхньої точки, поки ввімкнений, і повертається, коли ні
  L.lifts.forEach((l, k) => {
    s.lifts[k] += clamp((signal(s, l) ? Math.abs(l.y1 - l.y0) : 0) - s.lifts[k], -LIFT_SPEED, LIFT_SPEED);
  });
  // противага: поки на важкій платформі хтось стоїть, вона опускається, а друга піднімається
  let m = L.lilies.length + L.gondolas.length + L.lifts.length;
  L.pulleys.forEach((_, k) => {
    s.pulleys[k] += clamp((riders(m) ? 1000 : 0) - s.pulleys[k], -PULLEY_STEP, PULLEY_STEP);
    m += 2;
  });
  placeMovers(s, L, true);
}

// Один крок симуляції (1/60 секунди). input — біти натиснутих клавіш кожного гравця.
export function step(s: SimState, L: Level, input: [number, number], ev: SimEvent[] = []): SimEvent[] {
  s.tick++;
  const inp: [number, number] = s.won ? [0, 0] : input; // після перемоги герої заходять у двері
  const pressed: [number, number] = [inp[0] & ~s.prevInput[0], inp[1] & ~s.prevInput[1]];
  updateChar(s, L, 0, inp[0], pressed[0], ev);
  updateChar(s, L, 1, inp[1], pressed[1], ev);
  updateLink(s, pressed, ev);
  updateWorld(s, L, ev);
  s.prevInput = inp;
  return ev;
}

// Оцінка: ★ пройдено, ★★ половина скарбів, ★★★ усі скарби, діамантова — сердечко
export function rating(s: SimState, L: Level): { stars: number; diamond: boolean; gems: number; time: number } {
  let gems = 0, diamond = false;
  L.items.forEach((it, k) => { if (!s.taken[k]) return; if (it.kind === 'heart') diamond = true; else gems++; });
  const stars = 1 + (gems * 2 >= L.gemTotal ? 1 : 0) + (gems === L.gemTotal ? 1 : 0);
  return { stars, diamond, gems, time: s.won ? s.winTick : s.tick };
}
