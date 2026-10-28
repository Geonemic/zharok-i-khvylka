import { type G, TAU, clamp, noise1, ell, circ } from './draw';

// Поза героя для малювання (швидкості — у пікселях за тік)
export interface Pose {
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  linkDir: number; // у бік партнера, коли тримаються за руки; 0 — не тримаються
  blink: number; // 0…1
  runPhase: number;
  happy: boolean;
}

interface Limbs { feet: [number, number][]; hands: [number, number][] }
export function limbs(p: Pose, t: number): Limbs {
  const moving = p.grounded && Math.abs(p.vx) > 0.6, ph = p.runPhase;
  const feet: [number, number][] = [], hands: [number, number][] = [];
  for (const s of [-1, 1]) {
    let fx = s * 7, fy = -2.5;
    if (moving) { const a = Math.sin(ph + (s > 0 ? Math.PI : 0)); fx += a * 4 * Math.sign(p.vx); fy -= Math.max(0, a) * 3.5; }
    else if (!p.grounded) { fx = s * 6; fy = -4; }
    feet.push([fx, fy]);
    let hx = s * 18, hy = -15;
    if (moving) { hy += Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 2.5; hx += Math.cos(ph + (s > 0 ? 0 : Math.PI)) * 1.5; }
    else if (!p.grounded) { hx = s * 19; hy = p.vy < 0 ? -26 : -20; }
    else hy += Math.sin(t * 3.2 + s) * 1.2;
    if (p.linkDir === s) { hx = s * 20; hy = -13; }
    hands.push([hx, hy]);
  }
  return { feet, hands };
}

function hand(g: G, x: number, y: number, r: number, fill: string, stroke: string) {
  g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 1.5;
  circ(g, x, y, r); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; circ(g, x - r * 0.35, y - r * 0.35, r * 0.32); g.fill();
}

export function tongue(g: G, x: number, base: number, w: number, h: number, sway: number) {
  g.beginPath(); g.moveTo(x - w, base);
  g.quadraticCurveTo(x - w * 0.55 + sway * 0.35, base - h * 0.55, x + sway, base - h);
  g.quadraticCurveTo(x + w * 0.55 + sway * 0.35, base - h * 0.55, x + w, base);
  g.closePath();
}

interface FacePal { pupil: string; mouth: string; blush: string; lashes: boolean }
function drawFace(g: G, p: Pose, cy: number, pal: FacePal) {
  const look = p.linkDir || p.facing, lx = look * 2, ly = p.vy < -2 ? -1 : p.vy > 3 ? 1 : 0;
  for (const s of [-1, 1]) {
    const ex = s * 5.8 + lx, ey = cy - 2 + ly * 0.5, ry = 5.3 * (1 - p.blink * 0.92);
    if (ry > 1) {
      g.fillStyle = '#fffdf6'; ell(g, ex, ey, 4.3, ry); g.fill();
      g.strokeStyle = 'rgba(40,10,30,.35)'; g.lineWidth = 0.8; g.stroke();
      g.save(); ell(g, ex, ey, 4.3, ry); g.clip();
      const px = ex + look * 1.1, py = ey + 0.7 + ly;
      g.fillStyle = pal.pupil; circ(g, px, py, 2.75); g.fill();
      g.fillStyle = '#fff'; circ(g, px - 1.1, py - 1.6, 1.15); g.fill(); circ(g, px + 0.9, py + 0.9, 0.55); g.fill();
      g.restore();
    } else {
      g.strokeStyle = pal.pupil; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex - 3.4, ey); g.quadraticCurveTo(ex, ey + 2, ex + 3.4, ey); g.stroke();
    }
    if (pal.lashes && ry > 1) {
      // підводка верхньої повіки з маленьким завитком назовні
      g.strokeStyle = pal.pupil; g.lineWidth = 1.3; g.lineCap = 'round';
      g.beginPath(); g.ellipse(ex, ey, 4.4, ry + 0.2, 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      const ox = ex + s * 4.1, oy = ey - ry * 0.5;
      g.beginPath(); g.moveTo(ox, oy); g.quadraticCurveTo(ox + s * 1.6, oy - 0.6, ox + s * 2.3, oy - 2); g.stroke();
    }
  }
  g.fillStyle = pal.blush;
  for (const s of [-1, 1]) { ell(g, s * 10.2 + lx * 0.6, cy + 5, 3.2, 2); g.fill(); }
  const mx = lx * 0.7, my = cy + 6;
  if (!p.grounded && p.vy < -1) { g.fillStyle = pal.mouth; ell(g, mx, my + 0.5, 1.9, 2.5); g.fill(); }
  else if (p.happy) {
    g.fillStyle = pal.mouth; g.beginPath(); g.moveTo(mx - 3.8, my - 1.5); g.quadraticCurveTo(mx, my + 5.5, mx + 3.8, my - 1.5); g.closePath(); g.fill();
    g.fillStyle = '#ff7f8f'; ell(g, mx, my + 1.6, 1.8, 1); g.fill();
  } else {
    g.strokeStyle = pal.mouth; g.lineWidth = 1.7; g.lineCap = 'round';
    g.beginPath(); g.arc(mx, my - 2, 3.3, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
  }
}

// Жарок: тільце-жаринка з полум'яною короною й чубом. Точка (0, 0) — середина ніг.
export function drawZharok(g: G, p: Pose, t: number) {
  const L = limbs(p, t), cy = -19, stretch = 1 + clamp(p.vy * 0.035, -0.25, 0.35);
  const flames = [
    { bx: -10.5, h: 11, w: 5, ph: 0 }, { bx: 10.5, h: 11, w: 5, ph: 2.1 },
    { bx: -5.5, h: 19, w: 6.5, ph: 0.7 }, { bx: 5.5, h: 19, w: 6.5, ph: 2.8 },
    { bx: 0, h: 28, w: 8, ph: 1.4, chub: true },
  ].map((f) => {
    const fl = 0.82 + 0.18 * noise1(t * 6 + f.ph * 3);
    const sway = Math.sin(t * 6.3 + f.ph) * 2 - p.vx * 1.5 + f.bx * 0.35 - (f.chub ? p.facing * 3.5 : 0);
    return { ...f, sway, h: f.h * fl * stretch, base: cy - Math.sqrt(225 - f.bx * f.bx) + 5 };
  });
  const layer = (wk: number, hk: number, sk: number, db: number, paint: () => void) =>
    flames.forEach((f) => { tongue(g, f.bx, f.base + db, f.w * wk, f.h * hk, f.sway * sk); paint(); });
  // спершу спільний контур, потім заливки шарами — язики зливаються в один силует
  g.strokeStyle = '#8a220e'; g.lineWidth = 3.2; g.lineJoin = 'round';
  layer(1, 1, 1, 0, () => g.stroke());
  g.fillStyle = '#ff6a1c'; layer(1, 1, 1, 0, () => g.fill());
  g.fillStyle = '#ffaa33'; layer(0.66, 0.74, 0.92, 1, () => g.fill());
  g.fillStyle = '#fff0a0'; layer(0.36, 0.46, 0.85, 2, () => g.fill());
  for (const [x, y] of L.feet) { g.fillStyle = '#e0531d'; g.strokeStyle = '#7a1d0c'; g.lineWidth = 1.5; ell(g, x, y, 5.6, 3.8); g.fill(); g.stroke(); }
  const grd = g.createRadialGradient(-4, cy + 3, 1, 0, cy, 19);
  grd.addColorStop(0, '#fff6c8'); grd.addColorStop(0.32, '#ffd257'); grd.addColorStop(0.7, '#ff8a2a'); grd.addColorStop(1, '#e8461d');
  g.fillStyle = grd; ell(g, 0, cy, 15.5, 15); g.fill();
  g.strokeStyle = '#8a220e'; g.lineWidth = 2.2; g.stroke();
  g.strokeStyle = 'rgba(255,246,200,.75)'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.arc(0, cy, 11.5, Math.PI * 1.12, Math.PI * 1.42); g.stroke();
  g.fillStyle = 'rgba(255,240,170,.75)';
  for (const [x, y, r] of [[-7, cy + 9, 1.1], [6, cy + 10, 0.9], [10, cy + 5, 0.8]]) { circ(g, x, y, r); g.fill(); }
  drawFace(g, p, cy, { pupil: '#3b1206', mouth: '#7a1c0a', blush: 'rgba(255,70,90,.5)', lashes: false });
  for (const [x, y] of L.hands) hand(g, x, y, 4.6, '#ffbf47', '#8a220e');
}

function dropletPath(g: G, tip: number, cy: number, st: number) {
  g.beginPath(); g.moveTo(tip, cy - 24 - st);
  g.bezierCurveTo(tip * 0.5 + 5, cy - 17 - st * 0.6, 15.5, cy - 8, 15.5, cy + 2);
  g.bezierCurveTo(15.5, cy + 11, 8.5, cy + 16, 0, cy + 16);
  g.bezierCurveTo(-8.5, cy + 16, -15.5, cy + 11, -15.5, cy + 2);
  g.bezierCurveTo(-15.5, cy - 8, tip * 0.5 - 5, cy - 17 - st * 0.6, tip, cy - 24 - st);
  g.closePath();
}

function drawWreath(g: G, cy: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) { const u = -1 + i / 3; pts.push([u * 11.5, cy - 12.5 + u * u * 3.2]); }
  g.strokeStyle = '#1f5a2a'; g.lineWidth = 0.8;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    for (const s of [-1, 1]) { g.fillStyle = s > 0 ? '#3e9a4a' : '#56b55e'; ell(g, mx, my + s * 1.6, 3.2, 1.5, a + s * 0.5); g.fill(); g.stroke(); }
  }
  const cols = ['#ff4d5e', '#ffd23f', '#ffffff', '#ff4d5e', '#ffffff', '#ffd23f', '#6f8dff'];
  pts.forEach(([x, y], i) => {
    const r = i === 3 ? 3.4 : 2.6;
    g.fillStyle = cols[i]; g.strokeStyle = 'rgba(60,20,40,.45)'; g.lineWidth = 0.6;
    for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5 - Math.PI / 2; circ(g, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52); g.fill(); g.stroke(); }
    g.fillStyle = cols[i] === '#ffd23f' ? '#e2651f' : '#ffcf3a'; circ(g, x, y, r * 0.38); g.fill();
  });
}

// Хвилька: краплинка з хвилькою-завитком і купальським віночком. Точка (0, 0) — середина ніг.
export function drawKhvylka(g: G, p: Pose, t: number) {
  const L = limbs(p, t), cy = -19, back = -(p.linkDir || p.facing);
  // стрічки віночка розходяться віялом і майорять від руху
  const ribbons = ['#e8364a', '#ffd23f', '#3f7bff', '#3fbf5f'].map((c, i) => {
    const sx = back * 9, sy = cy - 11;
    const len = 16 + i * 2 + Math.min(10, Math.abs(p.vx) * 2.5), wav = Math.sin(t * 4.2 + i * 0.9) * 2.5;
    const ex = sx + back * len * (0.95 - i * 0.12), ey = sy + 4 + i * 4.5 + wav * 0.6 - (p.vy > 0 ? p.vy * 0.8 : 0);
    return { c, path: () => { g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + back * len * 0.5, sy - 2 + i * 1.5 + wav, ex, ey); } };
  });
  g.lineCap = 'round'; g.strokeStyle = '#13306b'; g.lineWidth = 4.4;
  for (const r of ribbons) { r.path(); g.stroke(); }
  g.lineWidth = 2.6;
  for (const r of ribbons) { r.path(); g.strokeStyle = r.c; g.stroke(); }
  for (const [x, y] of L.feet) { g.fillStyle = '#3d8fe8'; g.strokeStyle = '#163f8c'; g.lineWidth = 1.5; ell(g, x, y, 5.4, 3.7); g.fill(); g.stroke(); }
  const tip = Math.sin(t * 2.4) * 1.4 - p.vx * 1.3, st = clamp(p.vy * 0.25, -2, 3);
  dropletPath(g, tip, cy, st);
  const grd = g.createRadialGradient(-5, cy - 3, 1, 0, cy + 2, 22);
  grd.addColorStop(0, '#f2fdff'); grd.addColorStop(0.28, '#a8ecff'); grd.addColorStop(0.68, '#4cb2f4'); grd.addColorStop(1, '#2a6fd2');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = '#17469a'; g.lineWidth = 2.2; g.stroke();
  const tx = tip, ty = cy - 24 - st;
  const curl = () => {
    g.beginPath(); g.moveTo(tx, ty + 2);
    g.quadraticCurveTo(tx + back, ty - 6, tx + back * 6, ty - 5);
    g.quadraticCurveTo(tx + back * 9.5, ty - 2, tx + back * 6.5, ty + 0.5);
    g.quadraticCurveTo(tx + back * 4.5, ty + 1, tx + back * 5, ty - 1.5);
  };
  g.lineCap = 'round';
  curl(); g.strokeStyle = '#17469a'; g.lineWidth = 5; g.stroke();
  curl(); g.strokeStyle = '#d8f6ff'; g.lineWidth = 2.8; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, -8, cy - 3, 2.4, 5.2, 0.45); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
  circ(g, 7, cy + 9, 1.6); g.stroke(); circ(g, 10, cy + 4.5, 1); g.stroke();
  drawWreath(g, cy);
  drawFace(g, p, cy, { pupil: '#0e2d63', mouth: '#173f7a', blush: 'rgba(255,110,150,.55)', lashes: true });
  for (const [x, y] of L.hands) hand(g, x, y, 4.4, '#93e2ff', '#17469a');
}
