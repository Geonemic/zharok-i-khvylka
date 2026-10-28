import { type G, TAU, ell, circ, poly, fs, rr, star4, heartPath, drawGlow, GLOW, noise1 } from './draw';
import { tongue } from './characters';

// ===== Рідини =====
export type PoolKind = 'F' | 'W' | 'B';
export interface Pool { kind: PoolKind; x0: number; x1: number; y: number; bubbles: { x: number; r: number; max: number; sp: number }[] }

const POOL_PAL: Record<PoolKind, { body: string[]; line: string; glow: string; glowA: number }> = {
  F: { body: ['#ffe680', '#ffa133', '#ee5522', '#b8301a'], line: '#fff4b8', glow: '255,140,40', glowA: 0.34 },
  W: { body: ['#9be9ff', '#45a8f0', '#2464c2', '#1a4291'], line: '#effdff', glow: '90,190,255', glowA: 0.2 },
  B: { body: ['#a3b043', '#6f7d28', '#4a5419', '#2f3610'], line: '#d3e27a', glow: '170,200,60', glowA: 0.14 },
};

// front — напівпрозорий «передній край» поверх героя: ноги ніби занурені
export function drawPool(g: G, p: Pool, t: number, front: boolean) {
  const L = p.x0 + 3, R = p.x1 - 3, surf = p.y + 8, bot = p.y + 36, k = p.kind, pal = POOL_PAL[k];
  const amp = k === 'B' ? 0.9 : 1.4, spd = k === 'B' ? 0.8 : 2.2;
  const waveY = (x: number) => surf + Math.sin(x * 0.09 + t * spd) * amp + Math.sin(x * 0.21 - t * spd * 1.4) * amp * 0.6;
  g.save();
  g.beginPath(); g.rect(L, p.y - 40, R - L, bot - p.y + 40); g.clip();
  const grd = g.createLinearGradient(0, surf, 0, bot);
  pal.body.forEach((c, i) => grd.addColorStop(i / (pal.body.length - 1), c));
  g.globalAlpha = front ? 0.5 : 1;
  g.beginPath(); g.moveTo(L, bot);
  for (let x = L; x <= R; x += 3) g.lineTo(x, waveY(x));
  g.lineTo(R, waveY(R)); g.lineTo(R, bot); g.closePath();
  g.fillStyle = grd; g.fill();
  g.globalAlpha = 1;
  if (front) { g.restore(); return; }
  if (k === 'F') {
    const n = Math.floor((R - L) / 10);
    for (let i = 0; i < n; i++) {
      const px = L + 5 + i * ((R - L - 10) / Math.max(1, n - 1));
      const fl = 0.5 + 0.5 * noise1(t * 3.2 + i * 1.7 + p.x0 * 0.01);
      const h = 7 + 10 * fl, sw = Math.sin(t * 4 + i * 2.3) * 2, base = waveY(px) + 3;
      tongue(g, px, base, 5.5, h, sw); g.fillStyle = '#ff7a22'; g.fill();
      tongue(g, px, base + 1, 3.2, h * 0.62, sw * 0.8); g.fillStyle = '#ffe58a'; g.fill();
    }
  } else if (k === 'W') {
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2; g.beginPath();
    for (let x = L; x <= R; x += 4) { const y = surf + 13 + Math.sin(x * 0.07 - t * 1.6) * 1.6; if (x === L) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    const n = Math.max(2, Math.floor((R - L) / 22)), span = R - L;
    for (let i = 0; i < n; i++) {
      const gx = L + ((((i * 53 + t * 14 * (i % 2 ? 1 : -1)) % span) + span) % span);
      const gy = surf + 6 + (i % 3) * 6, a = 0.3 + 0.35 * Math.sin(t * 2 + i);
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 7, gy); g.stroke();
    }
  } else {
    g.fillStyle = 'rgba(40,46,14,.45)';
    for (let i = 0; i < 3; i++) { ell(g, L + ((i * 31 + t * 3) % (R - L)), surf + 10 + (i % 2) * 8, 6, 2.2); g.fill(); }
    for (const b of p.bubbles) {
      g.fillStyle = '#b9c85a'; circ(g, b.x, surf - b.r * 0.5, b.r); g.fill();
      g.strokeStyle = '#4d5a18'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; circ(g, b.x - b.r * 0.35, surf - b.r * 0.85, b.r * 0.28); g.fill();
    }
  }
  g.beginPath();
  for (let x = L; x <= R; x += 3) { if (x === L) g.moveTo(x, waveY(x)); else g.lineTo(x, waveY(x)); }
  g.strokeStyle = pal.line; g.lineWidth = k === 'W' ? 2.4 : 2; g.stroke();
  g.restore();
  g.globalCompositeOperation = 'lighter';
  const gg = g.createLinearGradient(0, surf - 36, 0, surf + 6);
  gg.addColorStop(0, `rgba(${pal.glow},0)`); gg.addColorStop(1, `rgba(${pal.glow},${pal.glowA})`);
  g.fillStyle = gg; g.fillRect(L - 6, surf - 36, R - L + 12, 42);
  g.globalCompositeOperation = 'source-over';
}

// ===== Латаття =====
function drawWaterLily(g: G, x: number, y: number, t: number) {
  const petal = (a: number, len: number, w: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(a);
    ell(g, 0, -len / 2, w, len / 2); g.fillStyle = col; g.fill();
    g.strokeStyle = 'rgba(160,60,110,.55)'; g.lineWidth = 0.8; g.stroke();
    g.restore();
  };
  for (const a of [-1.3, -0.65, 0.65, 1.3]) petal(a, 12, 4.4, '#ff9ec4');
  for (const a of [-0.95, -0.32, 0.32, 0.95]) petal(a + Math.sin(t * 1.5) * 0.03, 11, 3.8, '#ffe6f0');
  petal(0, 9, 3, '#fff6fa');
  g.fillStyle = '#ffcf3a'; circ(g, x, y - 3, 2.4); g.fill();
}
export function drawLily(g: G, cx: number, top: number, t: number, flower: boolean) {
  const cy = top + 3, notch = 0.75;
  g.fillStyle = 'rgba(10,40,90,.35)'; ell(g, cx + 2, cy + 4, 25, 5.5); g.fill();
  g.beginPath(); g.moveTo(cx, cy); g.ellipse(cx, cy, 24, 7, 0, notch + 0.32, notch - 0.32 + TAU); g.closePath();
  const grd = g.createLinearGradient(0, cy - 7, 0, cy + 7);
  grd.addColorStop(0, '#86da74'); grd.addColorStop(1, '#3a9443');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = '#1f5a2a'; g.lineWidth = 1.8; g.stroke();
  g.strokeStyle = 'rgba(190,245,170,.6)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { const a = notch + 0.6 + i * 0.85; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 5.2); g.stroke(); }
  if (flower) drawWaterLily(g, cx - 7, cy - 1, t);
}

// ===== Плити й ворота =====
// col — колір зв'язку з механізмом, яким плита керує
export function drawPlate(g: G, x: number, y: number, w: number, depress: number, pressed: boolean, col = '#ffd25a') {
  const top = y - 4 + depress * 3;
  g.fillStyle = '#1a1020'; rr(g, x - 3, y - 5, w + 6, 7, 3); g.fill();
  const grd = g.createLinearGradient(0, top, 0, top + 6);
  grd.addColorStop(0, '#c48a52'); grd.addColorStop(1, '#7a4a2a');
  g.fillStyle = grd; rr(g, x, top, w, 6, 3); g.fill();
  g.strokeStyle = '#3b2213'; g.lineWidth = 1.5; g.stroke();
  g.globalAlpha = pressed ? 1 : 0.6; g.fillStyle = col; rr(g, x + 6, top + 1.5, w - 12, 2.2, 1); g.fill(); g.globalAlpha = 1;
  if (depress > 0.05) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, x + w / 2, top, 28, 0.6 * depress);
    g.globalCompositeOperation = 'source-over';
  }
}

export function petrykivkaFlower(g: G, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#3f9a4a';
  for (const a of [-2.3, -0.85]) { g.save(); g.rotate(a); ell(g, 0, -9, 3.2, 8); g.fill(); g.restore(); }
  for (let i = 0; i < 7; i++) {
    g.save(); g.rotate(-Math.PI / 2 + (i - 3) * 0.42 + Math.PI / 2);
    g.fillStyle = i % 2 ? '#ff6b3d' : '#e8364a';
    g.beginPath(); g.moveTo(0, -3); g.bezierCurveTo(-4.5, -7, -3.5, -14, 0, -15); g.bezierCurveTo(3.5, -14, 4.5, -7, 0, -3); g.fill();
    g.fillStyle = '#ffd23f'; circ(g, 0, -12, 1.2); g.fill();
    g.restore();
  }
  g.fillStyle = '#ffd23f'; circ(g, 0, 0, 4); g.fill();
  g.fillStyle = '#e2651f'; circ(g, 0, 0, 1.8); g.fill();
  g.restore();
}

// Ворота: x — середина, top — верх прорізу, h — висота, open — 0…1
export function drawGate(g: G, x: number, top: number, h: number, open: number, powered: boolean, t: number, col = '#ffd25a') {
  const w = 22, gx = x - w / 2, y0 = top - open * h;
  g.save();
  g.beginPath(); g.rect(gx - 8, top, w + 16, h); g.clip();
  const grd = g.createLinearGradient(gx, 0, gx + w, 0);
  grd.addColorStop(0, '#8e5a33'); grd.addColorStop(0.5, '#a86d3e'); grd.addColorStop(1, '#73452a');
  g.fillStyle = grd; rr(g, gx, y0, w, h, 4); g.fill();
  g.strokeStyle = '#2c180c'; g.lineWidth = 2.5; g.stroke();
  g.strokeStyle = '#5c371f'; g.lineWidth = 1.2;
  for (const sx of [gx + 7.3, gx + 14.6]) { g.beginPath(); g.moveTo(sx, y0 + 3); g.lineTo(sx, y0 + h - 3); g.stroke(); }
  for (const by of [y0 + 30, y0 + h - 26]) {
    g.fillStyle = '#3a3850'; g.fillRect(gx - 1, by, w + 2, 6);
    g.fillStyle = '#9a98b8'; for (const rx of [gx + 4, gx + w - 4]) { circ(g, rx, by + 3, 1.3); g.fill(); }
  }
  petrykivkaFlower(g, x, y0 + h / 2 + 8, 0.62);
  g.globalAlpha = powered ? 1 : 0.7; g.fillStyle = col; star4(g, x, y0 + 14, 5); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = '#5a3a10'; g.lineWidth = 1; g.stroke();
  g.restore();
  if (powered || open > 0.02) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, x, Math.max(top + 6, y0 + 14), 24, 0.5 + 0.2 * Math.sin(t * 6));
    g.globalCompositeOperation = 'source-over';
  }
}

// ===== Скарби =====
export function drawSparkGem(g: G, t: number) {
  const P: Record<string, [number, number]> = { top: [0, -13], r: [9, -1], b: [0, 11], l: [-9, -1], c: [0, -2] };
  const face = (a: string, b: string, col: string) => { g.beginPath(); g.moveTo(...P[a]); g.lineTo(...P[b]); g.lineTo(...P.c); g.closePath(); g.fillStyle = col; g.fill(); };
  face('top', 'r', '#ffc552'); face('r', 'b', '#e8521f'); face('b', 'l', '#ff7a2a'); face('l', 'top', '#ffe08a');
  g.beginPath(); g.moveTo(...P.top); g.lineTo(...P.r); g.lineTo(...P.b); g.lineTo(...P.l); g.closePath();
  g.strokeStyle = '#7a1d0c'; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = '#fff'; star4(g, -3, -6, 2.5 + Math.sin(t * 5) * 1); g.fill();
}
function dropShape(g: G) {
  g.beginPath(); g.moveTo(0, -13);
  g.bezierCurveTo(3, -8, 9, -2, 9, 3); g.bezierCurveTo(9, 8.5, 5, 12, 0, 12);
  g.bezierCurveTo(-5, 12, -9, 8.5, -9, 3); g.bezierCurveTo(-9, -2, -3, -8, 0, -13);
  g.closePath();
}
export function drawDropGem(g: G, t: number) {
  dropShape(g);
  const grd = g.createRadialGradient(-3, 0, 1, 0, 2, 13);
  grd.addColorStop(0, '#f2fdff'); grd.addColorStop(0.4, '#7fd4ff'); grd.addColorStop(1, '#2d7de0');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = '#123d8a'; g.lineWidth = 1.8; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-4.5, 7); g.quadraticCurveTo(-6.5, 2, -3.5, -4); g.stroke();
  g.fillStyle = '#fff'; star4(g, -3, -2, 2.3 + Math.sin(t * 5 + 1) * 1); g.fill();
}
export function drawHeartGem(g: G) {
  heartPath(g, 0, 0, 11); g.fillStyle = '#ff6f9f'; g.fill();
  g.strokeStyle = '#8a1a43'; g.lineWidth = 1.8; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; ell(g, -4.5, -4, 2.4, 1.6, -0.6); g.fill();
}
export function drawItem(g: G, kind: string, x: number, y: number, t: number, i: number) {
  const yy = y + Math.sin(t * 2.4 + i) * 3, pulse = 1 + Math.sin(t * 3 + i) * 0.05;
  g.globalCompositeOperation = 'lighter';
  drawGlow(g, kind === 'spark' ? GLOW.fire : kind === 'drop' ? GLOW.water : GLOW.pink, x, yy, 26 * pulse, 0.6);
  g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(x, yy); g.scale(pulse, pulse);
  if (kind === 'spark') drawSparkGem(g, t); else if (kind === 'drop') drawDropGem(g, t); else drawHeartGem(g);
  g.restore();
}

// ===== Ліхтар-чекпоінт: загоряється, коли до нього дійшли =====
export function drawCheckpoint(g: G, x: number, y: number, lit: number, t: number) {
  g.strokeStyle = '#3a2614'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 44); g.lineTo(x + 9, y - 44); g.stroke();
  g.strokeStyle = '#8a5a34'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 44); g.lineTo(x + 9, y - 44); g.stroke();
  const lx = x + 9, ly = y - 34;
  if (lit > 0.02) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, lx, ly, 26 + 4 * Math.sin(t * 5), 0.65 * lit);
    g.globalCompositeOperation = 'source-over';
  }
  g.strokeStyle = '#3a2614'; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, y - 44); g.lineTo(lx, ly - 6); g.stroke();
  rr(g, lx - 4.5, ly - 6, 9, 12, 3);
  fs(g, lit > 0.5 ? '#ffe9a0' : '#5a5170', '#2c180c', 1.4);
  poly(g, [lx - 5.5, ly - 6, lx + 5.5, ly - 6, lx, ly - 10]); fs(g, '#8a4a2a', '#2c180c', 1);
  if (lit > 0.5) { g.fillStyle = '#ff9a3a'; ell(g, lx, ly + 1, 1.6, 2.6); g.fill(); }
}

// ===== Двері-виходи =====
const DOOR_W = 40, DOOR_H = 62;
function archPath(g: G, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
}
function sunOrnament(g: G, cx: number, cy: number, [c1, c2, c3]: string[]) {
  for (let i = 0; i < 8; i++) {
    g.save(); g.translate(cx, cy); g.rotate((i * TAU) / 8);
    g.fillStyle = i % 2 ? c2 : c1;
    g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(-3.2, -8, 0, -11.5); g.quadraticCurveTo(3.2, -8, 0, -3); g.fill();
    g.restore();
  }
  g.fillStyle = c1; circ(g, cx, cy, 3.6); g.fill();
  g.fillStyle = '#c2361c'; circ(g, cx, cy, 1.6); g.fill();
  for (const dy of [-23, -17]) { g.fillStyle = c3; circ(g, cx, cy + dy, 1.7); g.fill(); }
}
function waveOrnament(g: G, cx: number, cy: number, [c1, c2, c3]: string[]) {
  g.strokeStyle = c1; g.lineWidth = 1.8; g.lineCap = 'round';
  for (const dy of [-5, 3]) {
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const px = cx - 12 + i * 1.5, py = cy + dy + Math.sin(i * 0.8) * 2.2; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
  }
  for (const [dx, dy] of [[-8, -16], [0, -21], [8, -16]]) {
    g.fillStyle = c2;
    for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; circ(g, cx + dx + Math.cos(a) * 1.8, cy + dy + Math.sin(a) * 1.8, 1.3); g.fill(); }
    g.fillStyle = c3; circ(g, cx + dx, cy + dy, 1); g.fill();
  }
}
// Двері: x — середина, ground — рівень землі; lit — власник поруч; open — 0…1
export function drawDoor(g: G, fire: boolean, x: number, ground: number, lit: number, open: number, t: number) {
  const dx = x - DOOR_W / 2, y = ground - DOOR_H;
  const pal = fire
    ? { leaf: ['#b4452a', '#7e2a19'], line: '#5a1a0e', orn: ['#ffd23f', '#ff8a2a', '#fff0b0'], light: '255,205,120', glow: GLOW.fire }
    : { leaf: ['#3a7fd0', '#24559a'], line: '#143a70', orn: ['#ffffff', '#bfe9ff', '#ffd23f'], light: '175,232,255', glow: GLOW.water };
  archPath(g, dx - 7, y - 7, DOOR_W + 14, DOOR_H + 7);
  g.fillStyle = '#4a4064'; g.fill(); g.strokeStyle = '#140f26'; g.lineWidth = 2.5; g.stroke();
  g.strokeStyle = '#2e2746'; g.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i * Math.PI) / 6, r = DOOR_W / 2, cy = y + r;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7)); g.stroke();
  }
  for (const jy of [y + 32, y + 48]) for (const sx of [dx - 7, dx + DOOR_W]) { g.beginPath(); g.moveTo(sx, jy); g.lineTo(sx + 7, jy); g.stroke(); }
  archPath(g, dx, y, DOOR_W, DOOR_H);
  g.fillStyle = '#120c22'; g.fill();
  const ins = g.createLinearGradient(0, y, 0, y + DOOR_H);
  ins.addColorStop(0, `rgba(${pal.light},${0.2 + open * 0.8})`); ins.addColorStop(1, `rgba(${pal.light},${0.08 + open * 0.6})`);
  g.fillStyle = ins; g.fill();
  // стулка відчиняється всередину — звужується до петель ліворуч
  g.save(); archPath(g, dx, y, DOOR_W, DOOR_H); g.clip();
  g.translate(dx, 0); g.scale(1 - open * 0.82, 1);
  const lg = g.createLinearGradient(0, 0, DOOR_W, 0);
  lg.addColorStop(0, pal.leaf[0]); lg.addColorStop(1, pal.leaf[1]);
  g.fillStyle = lg; g.fillRect(0, y, DOOR_W, DOOR_H);
  g.strokeStyle = pal.line; g.lineWidth = 1.2;
  for (const px of [10, 20, 30]) { g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + DOOR_H); g.stroke(); }
  if (fire) sunOrnament(g, DOOR_W / 2, y + 38, pal.orn); else waveOrnament(g, DOOR_W / 2, y + 38, pal.orn);
  g.fillStyle = '#f3c14b'; circ(g, DOOR_W - 7, y + 42, 2.2); g.fill();
  g.strokeStyle = '#5a3a10'; g.lineWidth = 1; g.stroke();
  g.restore();
  archPath(g, dx, y, DOOR_W, DOOR_H); g.strokeStyle = '#140f26'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#6e4426'; rr(g, dx - 9, ground - 4, DOOR_W + 18, 5, 2); g.fill();
  g.strokeStyle = '#2c180c'; g.lineWidth = 1.5; g.stroke();
  const ey = y - 17;
  g.globalCompositeOperation = 'lighter';
  drawGlow(g, pal.glow, x, ey, 16 + lit * 16 + Math.sin(t * 4) * 2 * lit, 0.3 + lit * 0.55);
  if (open > 0.02) drawGlow(g, pal.glow, x, y + DOOR_H * 0.6, 54, 0.55 * open);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#2a2340'; circ(g, x, ey, 10.5); g.fill();
  g.strokeStyle = lit > 0.5 ? '#f3c14b' : '#140f26'; g.lineWidth = 2; g.stroke();
  g.save(); g.translate(x, ey); g.scale(0.62, 0.62);
  if (fire) drawSparkGem(g, t); else drawDropGem(g, t);
  g.restore();
}
