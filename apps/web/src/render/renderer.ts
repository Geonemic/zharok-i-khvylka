import { SUB, CHAR_W, CHAR_H, DOOR_REACH, DEATH_TICKS, signal, tideLevel, type Level, type SimState, type SimEvent } from '@zh/sim';
import { TILE_PX } from '@zh/levels';
import { type G, clamp, lerp, backOut, noise1, rr, heartPath, drawGlow, GLOW } from './draw';
import { drawZharok, drawKhvylka, type Pose } from './characters';
import { drawPool, drawLily, drawPlate, drawGate, drawItem, drawDoor, drawCheckpoint, drawSparkGem, drawDropGem, type Pool } from './objects';
import { findPools, paintTerrain } from './terrain';
import { getTheme, type Theme } from './themes';
import { Particles } from './fx';
import { CHANNEL_COLORS, drawTide, drawMooringPole, drawGondola, drawLever, drawLift, drawPulleyPad } from './mechanisms';

const px = (v: number) => v / SUB;
const CW = CHAR_W / SUB, CH = CHAR_H / SUB;
const fmtTime = (ticks: number) => { const s = Math.floor(ticks / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Те, що потрібно лише для краси й не входить у симуляцію
interface CharVis { sx: number; sy: number; svx: number; svy: number; blink: number; blinkT: number; blinkAnim: number; runPhase: number; appear: number; px: number; py: number }
const newVis = (): CharVis => ({ sx: 1, sy: 1, svx: 0, svy: 0, blink: 0, blinkT: 60 + Math.random() * 120, blinkAnim: 0, runPhase: 0, appear: 1, px: 0, py: 0 });

export type Tr = (key: string) => string;

export class Renderer {
  private ctx: G;
  private W: number;
  private H: number;
  private scale = 1;
  private dpr = 1;
  private ox = 0;
  private oy = 0;
  private theme: Theme;
  private pools: Pool[];
  private layers: { bg: HTMLCanvasElement; terrain: HTMLCanvasElement; vignette: HTMLCanvasElement } | null = null;
  private vis: [CharVis, CharVis] = [newVis(), newVis()];
  private plateDepress: number[];
  private cpLit: number[];
  private doorLit = [0, 0];
  private doorOpen = 0;
  private leverTilt: number[];
  // кольори зв'язків: ворота й ліфти мають свій колір, плити й важелі — колір механізму, яким керують
  private gateCol: string[];
  private liftCol: string[];
  private plateCol: string[];
  private leverCol: string[];
  private ceil: number[]; // для кожної рухомої платформи: де стеля, до якої тягнеться трос
  private fx = new Particles();
  private toasts: { key: string; t: number }[] = [];

  private canvas: HTMLCanvasElement;
  private L: Level;
  private tr: Tr;

  constructor(canvas: HTMLCanvasElement, L: Level, tr: Tr) {
    this.canvas = canvas;
    this.L = L;
    this.tr = tr;
    this.ctx = canvas.getContext('2d')!;
    this.W = L.cols * TILE_PX;
    this.H = L.rows * TILE_PX;
    this.theme = getTheme(L.data.theme);
    this.pools = findPools(L.data);
    this.plateDepress = L.plates.map(() => 0);
    this.cpLit = L.checkpoints.map(() => 0);
    this.leverTilt = L.levers.map((v) => (v.on ? 1 : -1));
    const col = (i: number) => CHANNEL_COLORS[i % CHANNEL_COLORS.length];
    this.gateCol = L.gates.map((_, k) => col(k));
    this.liftCol = L.lifts.map((_, k) => col(L.gates.length + k));
    this.plateCol = L.plates.map(() => CHANNEL_COLORS[0]);
    this.leverCol = L.levers.map(() => CHANNEL_COLORS[0]);
    [...L.gates.map((g, k) => [g, this.gateCol[k]] as const), ...L.lifts.map((l, k) => [l, this.liftCol[k]] as const)].reverse().forEach(([sig, c]) => {
      sig.plates.forEach((p) => { this.plateCol[p] = c; });
      sig.levers.forEach((v) => { this.leverCol[v] = c; });
    });
    // стеля над найвищою точкою кожної платформи
    const solid = (c: number, r: number) => r < 0 || '#FWB'.includes(L.data.tiles[r]?.[c] ?? '#');
    this.ceil = L.movers.map((m) => {
      let hi = 0, x = 0;
      if (m.kind === 'lift') { const l = L.lifts[m.ref]; hi = Math.min(l.y0, l.y1); x = l.x; }
      else if (m.kind === 'pulleyA') { const p = L.pulleys[m.ref]; hi = p.a.y; x = p.a.x; }
      else if (m.kind === 'pulleyB') { const p = L.pulleys[m.ref]; hi = p.b.y - p.db; x = p.b.x; }
      else return 0;
      const c = Math.floor(px(x) / TILE_PX);
      let r = Math.floor((px(hi) - 1) / TILE_PX);
      while (!solid(c, r)) r--;
      return (r + 1) * TILE_PX;
    });
  }

  setTr(tr: Tr) { this.tr = tr; }

  // Розмір полотна в CSS-пікселях; світ вписується з чорними смугами
  resize(cssW: number, cssH: number, dpr: number) {
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = Math.min(cssW / this.W, cssH / this.H);
    this.ox = (cssW - this.W * this.scale) / 2;
    this.oy = (cssH - this.H * this.scale) / 2;
    const k = this.scale * dpr;
    const layer = (paint: (g: G) => void) => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(this.W * k); c.height = Math.ceil(this.H * k);
      const g = c.getContext('2d')!;
      g.setTransform(k, 0, 0, k, 0, 0);
      paint(g);
      return c;
    };
    this.layers = {
      bg: layer((g) => this.theme.paintBackground(g, this.W, this.H)),
      terrain: layer((g) => paintTerrain(g, this.L.data, this.pools, this.theme.terrain)),
      vignette: layer((g) => {
        const vg = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.45, this.W / 2, this.H / 2, this.H * 0.95);
        vg.addColorStop(0, 'rgba(6,5,20,0)'); vg.addColorStop(1, 'rgba(6,5,20,.45)');
        g.fillStyle = vg; g.fillRect(0, 0, this.W, this.H);
      }),
    };
  }

  reset(s: SimState) {
    this.vis = [newVis(), newVis()];
    this.beforeStep(s);
    this.fx.clear();
    this.toasts = [];
    this.doorOpen = 0; this.doorLit = [0, 0];
    this.plateDepress.fill(0); this.cpLit.fill(0);
    for (const p of this.pools) p.bubbles.length = 0;
  }

  toast(key: string) { this.toasts = [{ key, t: 170 }]; }

  // Запам'ятовуємо позиції перед кроком, щоб плавно домальовувати між кроками
  beforeStep(s: SimState) {
    s.chars.forEach((c, i) => { this.vis[i].px = px(c.x); this.vis[i].py = px(c.y); });
  }

  afterStep(s: SimState, events: SimEvent[]) {
    const fx = this.fx;
    s.chars.forEach((c, i) => {
      const v = this.vis[i];
      if (--v.blinkT <= 0) { v.blinkT = 120 + Math.random() * 220; v.blinkAnim = 10; }
      if (v.blinkAnim > 0) v.blinkAnim--;
      v.blink = v.blinkAnim > 0 ? Math.sin((Math.PI * v.blinkAnim) / 10) : 0;
      v.svx = (v.svx + (1 - v.sx) * 0.22) * 0.72; v.sx += v.svx;
      v.svy = (v.svy + (1 - v.sy) * 0.22) * 0.72; v.sy += v.svy;
      if (c.alive && c.grounded) v.runPhase += Math.abs(px(c.vx)) * 0.085;
      if (v.appear > 0) v.appear = Math.max(0, v.appear - 0.07);
    });
    for (const e of events) this.onEvent(s, e);
    this.ambient(s);
    fx.update();
    for (const to of this.toasts) to.t--;
    this.toasts = this.toasts.filter((x) => x.t > 0);
    this.L.plates.forEach((_, k) => { this.plateDepress[k] += ((s.plates[k] ? 1 : 0) - this.plateDepress[k]) * 0.3; });
    this.L.checkpoints.forEach((_, k) => { this.cpLit[k] += ((k <= s.checkpoint ? 1 : 0) - this.cpLit[k]) * 0.1; });
    this.L.levers.forEach((_, k) => { this.leverTilt[k] += ((s.levers[k] ? 1 : -1) - this.leverTilt[k]) * 0.25; });
    this.L.doors.forEach((d, i) => {
      const c = s.chars[i];
      const at = c.alive && c.grounded && Math.abs(c.x + CHAR_W / 2 - d.x) < DOOR_REACH && Math.abs(c.y + CHAR_H - d.y) < 3 * SUB;
      this.doorLit[i] += ((at ? 1 : 0) - this.doorLit[i]) * 0.15;
    });
    this.doorOpen += ((s.won ? 1 : 0) - this.doorOpen) * 0.08;
  }

  private onEvent(s: SimState, e: SimEvent) {
    const fx = this.fx, rnd = Math.random;
    const feet = (who: number) => ({ x: px(s.chars[who].x) + CW / 2, y: px(s.chars[who].y) + CH });
    switch (e.type) {
      case 'jump': {
        const v = this.vis[e.who], f = feet(e.who);
        v.sx = 0.78; v.sy = 1.28; v.svx = v.svy = 0;
        for (let i = 0; i < 6; i++) fx.emit('steam', f.x + (rnd() - 0.5) * 16, f.y - 2, { vx: (rnd() - 0.5) * 1.6, vy: -rnd() * 0.6, size: 2 + rnd() * 2, grow: 0.08, life: 26, col: '#c9c2ea' });
        if (e.linked) for (let i = 0; i < 10; i++) fx.emit('steam', f.x + (rnd() - 0.5) * 30, f.y - 4, { vx: (rnd() - 0.5) * 2, vy: -0.5 - rnd(), size: 3 + rnd() * 3, grow: 0.15, life: 45, col: '#f4f7ff' });
        break;
      }
      case 'land': {
        const v = this.vis[e.who], k = clamp(px(e.impact) / 12, 0, 1), f = feet(e.who);
        v.sx = 1.06 + 0.3 * k; v.sy = 0.94 - 0.28 * k; v.svx = v.svy = 0;
        if (px(e.impact) > 4) for (let i = 0; i < 7; i++) {
          const sd = i % 2 ? 1 : -1;
          if (e.who === 1) fx.emit('dot', f.x + sd * 6, f.y - 3, { vx: sd * (0.8 + rnd() * 1.6), vy: -1 - rnd() * 1.6, g: 0.2, size: 1.6, life: 26, col: '#a6eaff' });
          else fx.emit('spark', f.x + sd * 6, f.y - 3, { vx: sd * (0.8 + rnd() * 1.6), vy: -0.6 - rnd() * 1.4, g: 0.05, size: 1.6, life: 26, col: '#ffcf6a', add: true, sprite: GLOW.fire });
        }
        break;
      }
      case 'die': {
        const f = feet(e.who), cy = f.y - 18, surf = px(e.surface);
        if (e.kind === 'sink') {
          for (let i = 0; i < 10; i++) fx.emit('ring', f.x + (rnd() - 0.5) * 30, surf, { vy: -0.2, size: 2 + rnd() * 3, grow: 0.12, life: 30 + rnd() * 20, col: '#d3e27a' });
          this.toast('deathBog');
        } else {
          const col = e.kind === 'extinguish' ? '#e4e6ef' : '#dff4ff';
          for (let i = 0; i < 30; i++) fx.emit('steam', f.x + (rnd() - 0.5) * 24, cy + (rnd() - 0.5) * 20, { vx: (rnd() - 0.5) * 1.4, vy: -0.6 - rnd() * 1.5, size: 3 + rnd() * 5, grow: 0.16, life: 50 + rnd() * 40, col });
          for (let i = 0; i < 9; i++) fx.emit('dot', f.x, cy, { vx: (rnd() - 0.5) * 3, vy: -1 - rnd() * 2, g: 0.15, size: 1.7, life: 40, col: e.kind === 'extinguish' ? '#5a2a1a' : '#8fdcff' });
          this.toast(e.kind === 'extinguish' ? 'deathZharok' : 'deathKhvylka');
        }
        break;
      }
      case 'respawn': {
        const v = this.vis[e.who], f = feet(e.who), col = e.who === 0 ? '#ffd27a' : '#bdf0ff';
        v.appear = 1; v.sx = v.sy = 1;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          fx.emit('star', f.x + Math.cos(a) * 26, f.y - 17 + Math.sin(a) * 26, { vx: -Math.cos(a) * 1.2, vy: -Math.sin(a) * 1.2, size: 1.6, life: 24, col, add: true, vr: 0.2 });
        }
        break;
      }
      case 'collect': {
        const it = this.L.items[e.index], x = px(it.x), y = px(it.y);
        const col = it.kind === 'spark' ? '#ffcf6a' : it.kind === 'drop' ? '#a6eaff' : '#ff8fb8';
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, sp = 1.5 + rnd() * 1.5;
          fx.emit('star', x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93, size: 1.4 + rnd(), life: 30, col, add: true, vr: 0.15 });
        }
        fx.emit('ring', x, y, { size: 6, grow: 1.2, life: 18, col });
        if (it.kind === 'heart') this.toast('heart');
        break;
      }
      case 'link': {
        const [a, b] = s.chars, mx = (px(a.x) + px(b.x) + CW) / 2, my = (px(a.y) + px(b.y)) / 2 + 14;
        for (let i = 0; i < 8; i++) fx.emit('star', mx + (rnd() - 0.5) * 20, my, { vx: (rnd() - 0.5) * 1.6, vy: -0.8 - rnd() * 1.2, drag: 0.96, size: 1.3 + rnd(), life: 40, col: i % 2 ? '#ffd27a' : '#bdf0ff', add: true, vr: 0.15 });
        this.toast('linked');
        break;
      }
      case 'unlink': this.toast('unlinked'); break;
      case 'lever': {
        const v = this.L.levers[e.index], col = this.leverCol[e.index];
        for (let i = 0; i < 8; i++) fx.emit('star', px(v.x) + (e.on ? 10 : -10), px(v.y) - 26, { vx: (rnd() - 0.5) * 2.2, vy: -rnd() * 2, drag: 0.94, size: 1.2 + rnd(), life: 28, col, add: true, vr: 0.15 });
        break;
      }
      case 'tooFar': this.toast('closer'); break;
      case 'gateShut': {
        const gt = this.L.gates[e.index];
        for (let i = 0; i < 8; i++) fx.emit('steam', px(gt.x) + (rnd() - 0.5) * 30, px(gt.top + gt.h) - 2, { vx: (rnd() - 0.5) * 2, vy: -rnd() * 0.5, size: 2 + rnd() * 2, grow: 0.08, life: 24, col: '#c9c2ea' });
        break;
      }
      case 'checkpoint': {
        const cp = this.L.checkpoints[e.index];
        for (let i = 0; i < 14; i++) fx.emit('star', px(cp.x) + 9, px(cp.y) - 34, { vx: (rnd() - 0.5) * 2.5, vy: -rnd() * 2.5, drag: 0.95, size: 1.3 + rnd(), life: 40, col: '#ffe08a', add: true, vr: 0.1 });
        this.toast('checkpoint');
        break;
      }
      case 'win': {
        this.L.doors.forEach((d, i) => {
          const col = i === 0 ? '#ffd27a' : '#bdf0ff';
          for (let k = 0; k < 24; k++) {
            const a = rnd() * Math.PI * 2, sp = 1 + rnd() * 2.5;
            fx.emit('star', px(d.x), px(d.y) - 40, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.95, size: 1.4 + rnd() * 1.4, life: 55, col, add: true, vr: 0.1 });
          }
        });
        break;
      }
    }
  }

  // Атмосферні частинки: іскри над жаром, бульбашки трясовини, іскри з корони Жарка, краплі Хвильки
  private ambient(s: SimState) {
    const fx = this.fx, rnd = Math.random;
    for (const p of this.pools) {
      const w = p.x1 - p.x0 - 6, surf = p.y + 8;
      if (p.kind === 'F' && rnd() < 0.0018 * w) fx.emit('spark', p.x0 + 3 + rnd() * w, surf - 2, { vx: (rnd() - 0.5) * 0.4, vy: -0.8 - rnd() * 1.4, g: -0.004, size: 1.3 + rnd(), life: 40 + rnd() * 40, col: '#ffcf6a', add: true, sprite: GLOW.fire });
      if (p.kind === 'B') {
        if (p.bubbles.length < w / 26 && rnd() < 0.04) p.bubbles.push({ x: p.x0 + 8 + rnd() * (w - 10), r: 0, max: 2.5 + rnd() * 3.5, sp: 0.04 + rnd() * 0.05 });
        for (let i = p.bubbles.length - 1; i >= 0; i--) {
          const b = p.bubbles[i];
          b.r += b.sp;
          if (b.r < b.max) continue;
          fx.emit('ring', b.x, surf - 1, { size: b.r, grow: 0.5, life: 14, col: '#d6e47c' });
          for (let k = 0; k < 3; k++) fx.emit('dot', b.x, surf - 2, { vx: (rnd() - 0.5) * 1.4, vy: -0.8 - rnd(), g: 0.12, size: 1.2, life: 18, col: '#8f9f3a' });
          p.bubbles.splice(i, 1);
        }
      }
    }
    const [a, b] = s.chars, entering = this.enterFade(s) > 0;
    if (a.alive && !entering && rnd() < 0.22) fx.emit('spark', px(a.x) + CW / 2 + (rnd() - 0.5) * 10, px(a.y) - 10, { vx: -px(a.vx) * 0.15 + (rnd() - 0.5) * 0.5, vy: -0.9 - rnd() * 1.2, g: -0.01, size: 1.1 + rnd() * 0.8, life: 30 + rnd() * 20, col: '#ffd36a', add: true, sprite: GLOW.fire });
    if (b.alive && b.grounded && Math.abs(px(b.vx)) > 1 && rnd() < 0.25) fx.emit('dot', px(b.x) + CW / 2 - b.facing * 8, px(b.y) + CH - 4, { vx: -b.facing * 0.8 + (rnd() - 0.5), vy: -1.2 - rnd(), g: 0.18, size: 1.5, life: 24, col: '#9fe6ff' });
    if (s.linked && !s.won) {
      const mx = (px(a.x) + px(b.x)) / 2 + CW / 2, my = (px(a.y) + px(b.y)) / 2 + CH - 14;
      if (rnd() < 0.35) fx.emit('steam', mx + (rnd() - 0.5) * 6, my, { vx: (rnd() - 0.5) * 0.4, vy: -0.6 - rnd() * 0.6, size: 2.5 + rnd() * 2, grow: 0.12, life: 50, col: '#f4f7ff' });
    }
    this.L.doors.forEach((d, i) => {
      if ((this.doorLit[i] > 0.5 && rnd() < 0.15) || (s.won && rnd() < 0.12)) {
        fx.emit('star', px(d.x) + (rnd() - 0.5) * 30, px(d.y) - 20 - rnd() * 60, { vy: -0.4, size: 1.2 + rnd(), life: 40, col: i === 0 ? '#ffd27a' : '#bdf0ff', add: true, vr: 0.05 });
      }
    });
  }

  // 0 → 1, поки герої після перемоги «заходять» у двері
  private enterFade(s: SimState) { return s.won ? clamp((s.tick - s.winTick - 18) / 28, 0, 1) : 0; }

  render(s: SimState, alpha: number, t: number) {
    const g = this.ctx, k = this.scale * this.dpr;
    if (!this.layers) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a0b1f'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);
    g.save();
    g.beginPath(); g.rect(0, 0, this.W, this.H); g.clip();
    g.drawImage(this.layers.bg, 0, 0, this.W, this.H);
    this.theme.drawAmbient(g, t, this.W, this.H);
    g.drawImage(this.layers.terrain, 0, 0, this.W, this.H);
    for (const p of this.pools) drawPool(g, p, t, false);
    this.drawTides(s, alpha, t, false);
    this.drawMovers(s, alpha, t);
    this.L.plates.forEach((p, i) => drawPlate(g, px(p.x), px(p.y), px(p.w), this.plateDepress[i], s.plates[i], this.plateCol[i]));
    this.L.levers.forEach((v, i) => drawLever(g, px(v.x), px(v.y), this.leverTilt[i], this.leverCol[i], t));
    this.L.gates.forEach((gt, i) => drawGate(g, px(gt.x), px(gt.top), px(gt.h), s.gates[i] / 1000, signal(s, gt), t, this.gateCol[i]));
    this.L.checkpoints.forEach((cp, i) => drawCheckpoint(g, px(cp.x), px(cp.y), this.cpLit[i], t));
    this.L.items.forEach((it, i) => { if (!s.taken[i]) drawItem(g, it.kind, px(it.x), px(it.y), t, i); });
    this.L.doors.forEach((d, i) => drawDoor(g, i === 0, px(d.x), px(d.y), this.doorLit[i], this.doorOpen, t));
    this.drawCharGlows(s, alpha, t);
    for (let i = 0; i < 2; i++) this.drawChar(s, i, alpha, t);
    this.drawLinkBridge(s, alpha, t);
    for (const p of this.pools) drawPool(g, p, t, true);
    this.drawTides(s, alpha, t, true);
    this.fx.draw(g);
    g.drawImage(this.layers.vignette, 0, 0, this.W, this.H);
    this.drawHUD(s, t);
    g.restore();
  }

  private tideAt(s: SimState, k: number, alpha: number) {
    return lerp(px(tideLevel(this.L, k, s.tick - 1)), px(tideLevel(this.L, k, s.tick)), alpha);
  }

  private drawTides(s: SimState, alpha: number, t: number, front: boolean) {
    this.L.tides.forEach((td, k) => {
      const x0 = px(td.x0), x1 = px(td.x1), bottom = px(td.bottom);
      if (!front) for (const x of [x0 + 12, x1 - 12]) drawMooringPole(this.ctx, x, px(td.high) - 34, bottom);
      drawTide(this.ctx, x0, x1, this.tideAt(s, k, alpha), bottom, t, front);
    });
  }

  // Рухомі платформи: латаття, гондоли, ліфти, противаги — плавно між кроками симуляції
  private drawMovers(s: SimState, alpha: number, t: number) {
    const g = this.ctx, L = this.L;
    L.movers.forEach((m, k) => {
      const x = px(s.mvX[k] - s.mvDx[k] * (1 - alpha)), y = px(s.mvY[k] - s.mvDy[k] * (1 - alpha)), w = px(m.w);
      const spin = y / 7;
      switch (m.kind) {
        case 'lily': drawLily(g, x, y, t, m.ref % 2 === 1); break;
        case 'gondola': drawGondola(g, x, y, w, t); break;
        case 'lift': drawLift(g, x, y, w, this.ceil[k], this.liftCol[m.ref], signal(s, L.lifts[m.ref]), spin); break;
        case 'pulleyA': case 'pulleyB': {
          const moving = s.mvDy[k] !== 0 || s.pulleys[m.ref] > 0;
          drawPulleyPad(g, x, y, w, this.ceil[k], m.kind === 'pulleyA', moving, CHANNEL_COLORS[0], spin);
          break;
        }
      }
    });
  }

  private charPos(s: SimState, i: number, alpha: number) {
    const c = s.chars[i], v = this.vis[i];
    return { x: lerp(v.px, px(c.x), alpha) + CW / 2, y: lerp(v.py, px(c.y), alpha) + CH };
  }

  private drawChar(s: SimState, i: number, alpha: number, t: number) {
    const g = this.ctx, c = s.chars[i], v = this.vis[i];
    if (!c.alive && c.deathT < DEATH_TICKS - 32) return;
    const { x: fx, y: fy } = this.charPos(s, i, alpha);
    let sc = 1, a = 1, sink = 0;
    g.save();
    if (!c.alive) {
      const p = clamp((DEATH_TICKS - c.deathT) / 32, 0, 1);
      if (c.deathKind === 'sink') { sink = p * 34; g.beginPath(); g.rect(fx - 80, fy - 140, 160, px(c.deathSurf) + 1 - (fy - 140)); g.clip(); }
      else { sc = 1 - p * 0.85; a = 1 - p; }
    }
    const e = this.enterFade(s);
    if (e >= 1) { g.restore(); return; }
    a *= 1 - e; sc *= 1 - e * 0.3;
    if (v.appear > 0) sc *= backOut(1 - v.appear);
    g.globalAlpha = a;
    g.translate(fx, fy + sink);
    g.rotate(clamp(px(c.vx) * 0.035, -0.15, 0.15));
    g.scale(v.sx * sc, v.sy * sc);
    if (c.grounded && Math.abs(px(c.vx)) < 0.4) g.translate(0, Math.sin(t * 3.2 + i * 1.4) * 1.1);
    const other = s.chars[1 - i];
    const pose: Pose = {
      vx: px(c.vx), vy: px(c.vy), grounded: c.grounded, facing: c.facing,
      linkDir: s.linked && !s.won ? Math.sign(other.x - c.x) || (i === 0 ? 1 : -1) : 0,
      blink: v.blink, runPhase: v.runPhase, happy: s.linked || s.won,
    };
    if (i === 0) drawZharok(g, pose, t); else drawKhvylka(g, pose, t);
    g.restore();
  }

  private drawCharGlows(s: SimState, alpha: number, t: number) {
    const g = this.ctx;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const c = s.chars[i];
      const fade = (c.alive ? 1 - this.vis[i].appear * 0.8 : clamp(1 - (DEATH_TICKS - c.deathT) / 32, 0, 1)) * (1 - this.enterFade(s));
      if (fade <= 0) continue;
      const p = this.charPos(s, i, alpha);
      if (i === 0) drawGlow(g, GLOW.fire, p.x, p.y - 26, 64 + noise1(t * 5) * 6, 0.45 * fade);
      else drawGlow(g, GLOW.water, p.x, p.y - 22, 48, 0.3 * fade);
    }
    g.globalCompositeOperation = 'source-over';
  }

  private drawLinkBridge(s: SimState, alpha: number, t: number) {
    if (!s.linked || s.won) return;
    const g = this.ctx, a = this.charPos(s, 0, alpha), b = this.charPos(s, 1, alpha), d = Math.sign(b.x - a.x) || 1;
    const ax = a.x + d * 20, ay = a.y - 13, bx = b.x - d * 20, by = b.y - 13;
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(ax, ay, bx, by);
    grd.addColorStop(0, 'rgba(255,170,70,.9)'); grd.addColorStop(1, 'rgba(110,210,255,.9)');
    g.strokeStyle = grd; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 4 - Math.sin(t * 5) * 2, bx, by); g.stroke();
    drawGlow(g, GLOW.white, (ax + bx) / 2, (ay + by) / 2, 18 + Math.sin(t * 4) * 3, 0.35);
    g.globalCompositeOperation = 'source-over';
  }

  private drawHUD(s: SimState, t: number) {
    const g = this.ctx, L = this.L;
    const count = (kind: string) => L.items.filter((it, i) => it.kind === kind && s.taken[i]).length;
    const total = (kind: string) => L.items.filter((it) => it.kind === kind).length;
    g.fillStyle = 'rgba(12,10,34,.8)'; rr(g, 10, 5, 330, 30, 15); g.fill();
    g.strokeStyle = 'rgba(243,193,75,.55)'; g.lineWidth = 1.2; g.stroke();
    g.font = '800 16px Nunito, system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#fff4e0';
    g.save(); g.translate(30, 20); g.scale(0.7, 0.7); drawSparkGem(g, t); g.restore();
    g.fillText(`${count('spark')}/${total('spark')}`, 44, 21);
    g.save(); g.translate(106, 20); g.scale(0.7, 0.7); drawDropGem(g, t); g.restore();
    g.fillText(`${count('drop')}/${total('drop')}`, 120, 21);
    heartPath(g, 184, 20, 7); g.fillStyle = '#ff6f9f'; g.fill(); g.strokeStyle = '#8a1a43'; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = '#fff4e0'; g.fillText(`${count('heart')}/${total('heart')}`, 196, 21);
    g.fillStyle = '#b9b3d9'; g.fillText(fmtTime(s.won ? s.winTick : s.tick), 262, 21);
    g.font = '900 20px Nunito, system-ui, sans-serif'; g.textAlign = 'center';
    const name = this.tr(`level.${L.data.id}`);
    g.lineWidth = 5; g.strokeStyle = '#140f26'; g.lineJoin = 'round'; g.strokeText(name, this.W / 2, 21);
    g.fillStyle = '#fff0c0'; g.fillText(name, this.W / 2, 21);
    for (const to of this.toasts) {
      g.globalAlpha = Math.min(1, to.t / 30, (170 - to.t) / 12);
      g.font = '800 17px Nunito, system-ui, sans-serif';
      const text = this.tr(`toast.${to.key}`), w = g.measureText(text).width + 44;
      g.fillStyle = 'rgba(12,10,34,.85)'; rr(g, this.W / 2 - w / 2, 48, w, 32, 16); g.fill();
      g.strokeStyle = 'rgba(243,193,75,.5)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#fff4e0'; g.fillText(text, this.W / 2, 65);
      g.globalAlpha = 1;
    }
  }
}
