import { type G, TAU, ell, circ, rr, drawGlow, GLOW } from './draw';

// Колір зв'язку: плита чи важіль світиться тим самим кольором, що й механізм, яким керує
export const CHANNEL_COLORS = ['#ffd25a', '#c9a2ff', '#6fe3cc', '#ff9ab5', '#b4ea72'];

// ===== Приплив: глибока вода, що піднімається й спадає =====
// front — напівпрозорий шар поверх героїв, щоб було видно, хто занурений
export function drawTide(g: G, x0: number, x1: number, surf: number, bottom: number, t: number, front: boolean) {
  if (bottom - surf < 1) return;
  const waveY = (x: number) => surf + Math.sin(x * 0.06 + t * 1.8) * 1.6 + Math.sin(x * 0.17 - t * 2.6) * 0.8;
  g.save();
  g.beginPath(); g.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 4) g.lineTo(x, waveY(x));
  g.lineTo(x1, waveY(x1)); g.lineTo(x1, bottom); g.closePath();
  const grd = g.createLinearGradient(0, surf, 0, Math.max(surf + 40, bottom));
  grd.addColorStop(0, front ? 'rgba(120,220,255,.42)' : '#6fcdf6');
  grd.addColorStop(0.35, front ? 'rgba(50,140,225,.4)' : '#3d93e0');
  grd.addColorStop(1, front ? 'rgba(25,70,160,.5)' : '#1d4c9e');
  g.fillStyle = grd; g.fill();
  if (front) { g.restore(); return; }
  g.clip();
  // течія: світлі риски, що повільно пливуть
  const span = x1 - x0, n = Math.max(3, Math.floor(span / 30));
  for (let i = 0; i < n; i++) {
    const gx = x0 + ((((i * 71 + t * 16 * (i % 2 ? 1 : -1)) % span) + span) % span);
    const gy = surf + 10 + ((i * 37) % Math.max(10, bottom - surf - 14));
    g.strokeStyle = `rgba(255,255,255,${0.18 + 0.2 * Math.sin(t * 2 + i)})`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 9, gy); g.stroke();
  }
  g.restore();
  g.beginPath();
  for (let x = x0; x <= x1; x += 4) { if (x === x0) g.moveTo(x, waveY(x)); else g.lineTo(x, waveY(x)); }
  g.strokeStyle = '#effdff'; g.lineWidth = 2.4; g.stroke();
  g.globalCompositeOperation = 'lighter';
  const gg = g.createLinearGradient(0, surf - 30, 0, surf + 4);
  gg.addColorStop(0, 'rgba(90,190,255,0)'); gg.addColorStop(1, 'rgba(90,190,255,.2)');
  g.fillStyle = gg; g.fillRect(x0, surf - 30, x1 - x0, 34);
  g.globalCompositeOperation = 'source-over';
}

// Смугасті палі для швартування: показують, як високо підіймається вода (прикраса, без світіння)
export function drawMooringPole(g: G, x: number, top: number, bottom: number) {
  g.fillStyle = '#1a1424'; rr(g, x - 4, top - 1, 8, bottom - top + 1, 3); g.fill();
  for (let y = top, k = 0; y < bottom; y += 10, k++) { g.fillStyle = k % 2 ? '#3d5b8a' : '#b9b4c8'; g.fillRect(x - 2.5, y, 5, Math.min(10, bottom - y)); }
  g.fillStyle = '#d8b25a'; circ(g, x, top, 3.5); g.fill();
}

// ===== Гондола: палуба — тепла дерев'яна смуга, по якій ходять =====
export function drawGondola(g: G, cx: number, deck: number, w: number, t: number) {
  const L = cx - w / 2, R = cx + w / 2, bob = Math.sin(t * 2.1) * 0.6;
  const d = deck + bob;
  g.fillStyle = 'rgba(10,30,70,.35)'; ell(g, cx, d + 18, w * 0.5, 4); g.fill();
  // корпус-півмісяць із піднятими кінцями
  g.beginPath();
  g.moveTo(L - 6, d - 12);
  g.quadraticCurveTo(L + 2, d + 2, L + 14, d + 4);
  g.lineTo(R - 14, d + 4);
  g.quadraticCurveTo(R + 4, d + 2, R + 10, d - 20);
  g.lineTo(R + 13, d - 20);
  g.quadraticCurveTo(R + 8, d + 10, R - 12, d + 15);
  g.quadraticCurveTo(cx, d + 20, L + 10, d + 14);
  g.quadraticCurveTo(L - 4, d + 6, L - 8, d - 11);
  g.closePath();
  const hull = g.createLinearGradient(0, d - 4, 0, d + 18);
  hull.addColorStop(0, '#2c2540'); hull.addColorStop(1, '#120e1c');
  g.fillStyle = hull; g.fill();
  g.strokeStyle = '#08060e'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = '#d8a748'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(L + 6, d + 9); g.quadraticCurveTo(cx, d + 13, R - 6, d + 9); g.stroke();
  // ферро — гребінь на носі
  g.fillStyle = '#e8e2f0'; g.strokeStyle = '#2a2436'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(R + 9, d - 18); g.lineTo(R + 17, d - 26); g.lineTo(R + 19, d - 22); g.lineTo(R + 13, d - 14); g.closePath(); g.fill(); g.stroke();
  for (let k = 0; k < 4; k++) { g.fillRect(R + 9 + k * 0.6, d - 12 + k * 3.4, 7, 1.6); }
  // палуба
  const deckG = g.createLinearGradient(0, d, 0, d + 6);
  deckG.addColorStop(0, '#e2b06b'); deckG.addColorStop(1, '#9b6735');
  g.fillStyle = '#2a170a'; rr(g, L + 6, d - 1.5, w - 12, 8, 3); g.fill();
  g.fillStyle = deckG; rr(g, L + 7, d - 0.5, w - 14, 6, 2.5); g.fill();
  g.fillStyle = '#ffd796'; g.fillRect(L + 10, d - 0.5, w - 20, 1.6);
  g.strokeStyle = 'rgba(80,45,15,.55)'; g.lineWidth = 1;
  for (let x = L + 22; x < R - 12; x += 18) { g.beginPath(); g.moveTo(x, d + 0.5); g.lineTo(x, d + 5); g.stroke(); }
}

// ===== Важіль: ручка нахиляється туди, куди його штовхнули =====
// tilt — від -1 (вимкнено, ліворуч) до 1 (увімкнено, праворуч)
export function drawLever(g: G, x: number, y: number, tilt: number, col: string, t: number) {
  const a = tilt * 0.75, len = 24, px = x, py = y - 7;
  const kx = px + Math.sin(a) * len, ky = py - Math.cos(a) * len, on = tilt > 0;
  g.strokeStyle = '#140f26'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(px, py); g.lineTo(kx, ky); g.stroke();
  g.strokeStyle = '#a7a4bf'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(px, py); g.lineTo(kx, ky); g.stroke();
  g.fillStyle = '#140f26'; rr(g, x - 14, y - 9, 28, 10, [5, 5, 1, 1]); g.fill();
  g.fillStyle = '#4c4766'; rr(g, x - 12, y - 7, 24, 7, [4, 4, 0, 0]); g.fill();
  g.fillStyle = on ? col : '#6b6684'; circ(g, x - 7, y - 3.5, 1.6); g.fill();
  circ(g, x + 7, y - 3.5, 1.6); g.fill();
  if (on) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, kx, ky, 18 + Math.sin(t * 5) * 2, 0.45);
    g.globalCompositeOperation = 'source-over';
  }
  g.fillStyle = col; circ(g, kx, ky, 5.5); g.fill();
  g.strokeStyle = '#140f26'; g.lineWidth = 1.8; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.6)'; circ(g, kx - 1.8, ky - 1.8, 1.6); g.fill();
}

// Трос від платформи до стелі з колесом нагорі
function cable(g: G, x: number, from: number, ceil: number, spin: number) {
  g.strokeStyle = '#140f26'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, ceil + 6); g.lineTo(x, from); g.stroke();
  g.strokeStyle = '#8f8ba8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, ceil + 6); g.lineTo(x, from); g.stroke();
  g.fillStyle = '#140f26'; circ(g, x, ceil + 6, 6.5); g.fill();
  g.fillStyle = '#5d5878'; circ(g, x, ceil + 6, 5); g.fill();
  g.strokeStyle = '#2a2540'; g.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { const a = spin + (k * TAU) / 3; g.beginPath(); g.moveTo(x, ceil + 6); g.lineTo(x + Math.cos(a) * 4.5, ceil + 6 + Math.sin(a) * 4.5); g.stroke(); }
}

// ===== Ліфт: металева платформа на двох тросах =====
export function drawLift(g: G, cx: number, top: number, w: number, ceil: number, col: string, active: boolean, spin: number) {
  const L = cx - w / 2;
  cable(g, L + 8, top, ceil, spin);
  cable(g, L + w - 8, top, ceil, -spin);
  g.fillStyle = '#140f26'; rr(g, L - 2, top - 2, w + 4, 16, 4); g.fill();
  const grd = g.createLinearGradient(0, top, 0, top + 12);
  grd.addColorStop(0, '#b9c3d6'); grd.addColorStop(1, '#5d6680');
  g.fillStyle = grd; rr(g, L, top, w, 12, 3); g.fill();
  g.fillStyle = '#e6edf8'; g.fillRect(L + 3, top, w - 6, 2);
  g.fillStyle = active ? col : 'rgba(30,26,50,.55)'; rr(g, cx - 12, top + 4, 24, 4, 2); g.fill();
  g.fillStyle = '#3a4058'; for (const rx of [L + 5, L + w - 5]) { circ(g, rx, top + 7, 1.4); g.fill(); }
  if (active) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, cx, top + 6, 22, 0.35);
    g.globalCompositeOperation = 'source-over';
  }
}

// ===== Противага: важка платформа зі стрілкою вниз і легка зі стрілкою вгору =====
export function drawPulleyPad(g: G, cx: number, top: number, w: number, ceil: number, heavy: boolean, moving: boolean, col: string, spin: number) {
  const L = cx - w / 2;
  cable(g, cx, top, ceil, heavy ? spin : -spin);
  g.strokeStyle = '#140f26'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(L + 6, top); g.lineTo(cx, top - 14); g.lineTo(L + w - 6, top); g.stroke();
  g.fillStyle = '#140f26'; rr(g, L - 2, top - 2, w + 4, 16, 4); g.fill();
  const grd = g.createLinearGradient(0, top, 0, top + 12);
  if (heavy) { grd.addColorStop(0, '#8d8aa0'); grd.addColorStop(1, '#3c3a50'); }
  else { grd.addColorStop(0, '#c58c52'); grd.addColorStop(1, '#6e4426'); }
  g.fillStyle = grd; rr(g, L, top, w, 12, 3); g.fill();
  g.fillStyle = heavy ? '#c9c6da' : '#e2ad6e'; g.fillRect(L + 3, top, w - 6, 2);
  // стрілка: важка опускається, легка піднімається
  const ay = top + 6, s = heavy ? 1 : -1;
  g.fillStyle = moving ? col : 'rgba(20,15,38,.6)';
  g.beginPath(); g.moveTo(cx - 6, ay - 3 * s); g.lineTo(cx + 6, ay - 3 * s); g.lineTo(cx, ay + 3 * s); g.closePath(); g.fill();
  if (moving) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, GLOW.gold, cx, ay, 18, 0.35);
    g.globalCompositeOperation = 'source-over';
  }
}
