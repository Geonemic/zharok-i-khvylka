// Дрібні помічники малювання на полотні
export type G = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const backOut = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
export const noise1 = (x: number) => Math.sin(x * 1.3 + Math.sin(x * 0.7) * 1.7) * 0.5 + Math.sin(x * 2.9 + 1.3) * 0.3 + Math.sin(x * 5.3 + 0.4) * 0.2;

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rr(g: G, x: number, y: number, w: number, h: number, r: number | number[]) { g.beginPath(); g.roundRect(x, y, w, h, r); }
export function ell(g: G, x: number, y: number, rx: number, ry: number, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); }
export function circ(g: G, x: number, y: number, r: number) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
export function poly(g: G, pts: number[]) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
export function fs(g: G, fill: string | CanvasGradient, stroke?: string, lw = 1.2) {
  g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
export function star4(g: G, x: number, y: number, r: number, rot = 0) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, q = i % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  g.closePath();
}
export function heartPath(g: G, x: number, y: number, s: number) {
  g.beginPath(); g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  g.closePath();
}

// М'які плями світла: малюються один раз, далі лише копіюються (швидко)
function makeGlow(r: number, gg: number, b: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${gg},${b},.45)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return c;
}
export const GLOW = {
  fire: makeGlow(255, 140, 50), water: makeGlow(80, 190, 255), gold: makeGlow(255, 205, 90),
  fly: makeGlow(210, 255, 120), white: makeGlow(255, 255, 255), pink: makeGlow(255, 120, 170),
};
export function drawGlow(g: G, sprite: HTMLCanvasElement, x: number, y: number, r: number, a: number) {
  g.globalAlpha = a; g.drawImage(sprite, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}
