import { type G, TAU, mulberry32, circ, star4, drawGlow, GLOW } from './draw';
import type { TerrainPalette } from './terrain';

// Тема країни: лише вигляд. Механіки від теми не залежать (див. docs/design.md, «Теми країн»).
export interface Theme {
  id: string;
  terrain: TerrainPalette;
  paintBackground(g: G, w: number, h: number): void;
  drawAmbient(g: G, t: number, w: number, h: number): void; // живий фон позаду землі
}

// ===== Україна: Купальська ніч =====
function ridge(g: G, w: number, h: number, baseY: number, amp: number, seed: number, color: string, step: number) {
  const r = mulberry32(seed), p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) {
    g.lineTo(x, baseY - amp * (0.55 * Math.sin(x * 0.0042 + p1) + 0.3 * Math.sin(x * 0.0115 + p2) + 0.15 * Math.abs(Math.sin(x * 0.03 + p3))));
  }
  g.lineTo(w, h); g.closePath(); g.fill();
}
function mist(g: G, w: number, y: number, rgb: string, a: number) {
  const gr = g.createLinearGradient(0, y - 60, 0, y + 60);
  gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.5, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, y - 60, w, 120);
}
function firs(g: G, w: number, h: number, baseY: number, color: string) {
  const r = mulberry32(21);
  g.fillStyle = color; g.fillRect(0, baseY, w, h - baseY);
  for (let x = -10; x < w + 20; x += 14 + r() * 18) {
    const th = 40 + r() * 50, tw = th * 0.36, y = baseY + 4 - r() * 10;
    const tiers = [1, 2, 3, 4].map((k) => [y - th + (th * k) / 4, (tw * k) / 4 + 3]);
    g.beginPath(); g.moveTo(x, y - th);
    tiers.forEach(([yy, ww], i) => { g.lineTo(x + ww, yy); if (i < 3) g.lineTo(x + ww * 0.4, yy - 3); });
    g.lineTo(x + 3, y); g.lineTo(x + 3, y + 8); g.lineTo(x - 3, y + 8); g.lineTo(x - 3, y);
    for (let i = 3; i >= 0; i--) { const [yy, ww] = tiers[i]; g.lineTo(x - ww, yy); if (i > 0) g.lineTo(x - tiers[i - 1][1] * 0.4, tiers[i - 1][0] - 3); }
    g.closePath(); g.fill();
  }
}

const flies = Array.from({ length: 26 }, (_, i) => { const r = mulberry32(100 + i); return { x: r(), y: 0.17 + r() * 0.78, ph: r() * TAU, sp: 0.3 + r() * 0.5, amp: 20 + r() * 30 }; });
const twinkles = (() => { const r = mulberry32(77); return Array.from({ length: 30 }, () => ({ x: r(), y: r() * 0.42, ph: r() * TAU, sp: 1 + r() * 2 })); })();

const kupala: Theme = {
  id: 'ukraine/kupala',
  terrain: {
    outline: '#140f26', stone: '#3b3254', stoneLight: '#453c62', stoneHighlight: 'rgba(110,98,150,.35)', speck: '#2b2442',
    underside: 'rgba(25,18,45,.75)', grass: '#4c9a48', grassLight: '#86d06a', grassBlade: '#6fbf5a',
    flowers: ['#ff6b7a', '#ffd34d', '#ffffff', '#a9c0ff'],
  },
  paintBackground(g, w, h) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d1236'); sky.addColorStop(0.4, '#1f2462'); sky.addColorStop(0.75, '#3b3274'); sky.addColorStop(1, '#5a3f78');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // Чумацький Шлях
    g.save(); g.translate(w * 0.55, h * 0.2); g.rotate(-0.35); g.scale(1, 0.16);
    const mw = g.createRadialGradient(0, 0, 0, 0, 0, 700);
    mw.addColorStop(0, 'rgba(200,190,255,.17)'); mw.addColorStop(1, 'rgba(200,190,255,0)');
    g.fillStyle = mw; circ(g, 0, 0, 700); g.fill(); g.restore();
    const r = mulberry32(11);
    for (let i = 0; i < 220; i++) {
      const x = r() * w, y = r() * h * 0.62, big = r() < 0.08;
      g.globalAlpha = 0.25 + r() * 0.6; g.fillStyle = r() < 0.2 ? '#ffe2b0' : '#f2f0ff';
      circ(g, x, y, big ? 1.5 : 0.5 + r() * 0.7); g.fill();
    }
    g.globalAlpha = 1;
    const mx = w * 0.62, my = 92;
    const halo = g.createRadialGradient(mx, my, 20, mx, my, 150);
    halo.addColorStop(0, 'rgba(255,236,200,.33)'); halo.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = halo; g.fillRect(mx - 150, my - 150, 300, 300);
    const moon = g.createRadialGradient(mx - 8, my - 8, 4, mx, my, 30);
    moon.addColorStop(0, '#fffaf0'); moon.addColorStop(1, '#f1dcae');
    g.fillStyle = moon; circ(g, mx, my, 28); g.fill();
    g.fillStyle = 'rgba(200,165,120,.25)';
    for (const [dx, dy, cr] of [[-9, -6, 6], [8, 5, 4], [-2, 11, 3]]) { circ(g, mx + dx, my + dy, cr); g.fill(); }
    ridge(g, w, h, h * 0.46, 110, 3, '#2b2a66', 6);
    mist(g, w, h * 0.5, '160,150,230', 0.07);
    ridge(g, w, h, h * 0.625, 80, 5, '#232259', 5);
    mist(g, w, h * 0.67, '160,150,230', 0.06);
    ridge(g, w, h, h * 0.79, 50, 9, '#1c1b4a', 4);
    firs(g, w, h, h * 0.9, '#16153d');
  },
  drawAmbient(g, t, w, h) {
    g.globalCompositeOperation = 'lighter';
    for (const s of twinkles) {
      const a = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 3) * 0.9;
      if (a < 0.02) continue;
      g.globalAlpha = a; g.fillStyle = '#fff8e0'; star4(g, s.x * w, s.y * h, 3.5, 0); g.fill();
    }
    for (const f of flies) {
      const x = f.x * w + Math.sin(t * f.sp + f.ph) * f.amp, y = f.y * h + Math.cos(t * f.sp * 1.3 + f.ph) * f.amp * 0.5;
      const a = 0.35 + 0.35 * Math.sin(t * 2.5 + f.ph * 3);
      drawGlow(g, GLOW.fly, x, y, 9, a);
      g.globalAlpha = a; g.fillStyle = '#f2ffc0'; circ(g, x, y, 1.3); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
};

// ===== Спільне для міст: небо, зорі, місяць, вікна =====
function nightSky(g: G, w: number, h: number, stops: string[], seed: number, stars: number) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => sky.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const r = mulberry32(seed);
  for (let i = 0; i < stars; i++) {
    g.globalAlpha = 0.2 + r() * 0.5; g.fillStyle = r() < 0.2 ? '#ffe2b0' : '#f2f0ff';
    circ(g, r() * w, r() * h * 0.5, 0.5 + r() * 0.8); g.fill();
  }
  g.globalAlpha = 1;
}
function crescent(g: G, x: number, y: number, rad: number, sky: string) {
  const halo = g.createRadialGradient(x, y, rad * 0.6, x, y, rad * 4.5);
  halo.addColorStop(0, 'rgba(255,236,200,.22)'); halo.addColorStop(1, 'rgba(255,236,200,0)');
  g.fillStyle = halo; g.fillRect(x - rad * 5, y - rad * 5, rad * 10, rad * 10);
  g.fillStyle = '#f6e7c4'; circ(g, x, y, rad); g.fill();
  g.fillStyle = sky; circ(g, x + rad * 0.45, y - rad * 0.2, rad * 0.9); g.fill();
}
interface Win { x: number; y: number; w: number; h: number; arch: boolean; ph: number }
function windowShape(g: G, wd: Win) {
  if (wd.arch) { g.beginPath(); g.moveTo(wd.x, wd.y + wd.h); g.lineTo(wd.x, wd.y + wd.w / 2); g.arc(wd.x + wd.w / 2, wd.y + wd.w / 2, wd.w / 2, Math.PI, 0); g.lineTo(wd.x + wd.w, wd.y + wd.h); g.closePath(); }
  else { g.beginPath(); g.rect(wd.x, wd.y, wd.w, wd.h); }
}
const twinkleStars = (seed: number) => { const r = mulberry32(seed); return Array.from({ length: 22 }, () => ({ x: r(), y: r() * 0.4, ph: r() * TAU, sp: 0.8 + r() * 1.6 })); };
function drawTwinkles(g: G, list: { x: number; y: number; ph: number; sp: number }[], t: number, w: number, h: number) {
  g.globalCompositeOperation = 'lighter';
  for (const s of list) {
    const a = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 3) * 0.8;
    if (a < 0.02) continue;
    g.globalAlpha = a; g.fillStyle = '#fff8e0'; star4(g, s.x * w, s.y * h, 3.2, 0); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
// Вікна, що тихо мерехтять теплим світлом (запам'ятовуємо, де їх намалювали на фоні)
function drawWindows(g: G, wins: Win[], t: number) {
  for (const wd of wins) {
    g.globalAlpha = 0.12 + 0.1 * Math.sin(t * 0.7 + wd.ph);
    g.fillStyle = '#ffc47a'; windowShape(g, wd); g.fill();
  }
  g.globalAlpha = 1;
}

// ===== Італія: Венеція в синю годину =====
const veniceWins: Win[] = [];
function venetianRow(g: G, w: number, h: number, baseY: number, color: string, seed: number, tall: number, wins: Win[] | null) {
  const r = mulberry32(seed);
  g.fillStyle = color;
  for (let x = -20; x < w + 20;) {
    const bw = 50 + r() * 70, bh = tall * (0.5 + r() * 0.5), top = baseY - bh;
    g.fillRect(x, top, bw + 1, h - top);
    g.fillRect(x - 3, top - 4, bw + 7, 5); // карниз
    if (r() < 0.6) { // венеційський комин — лійка догори
      const cx = x + 10 + r() * (bw - 20), ch = 14 + r() * 10;
      g.fillRect(cx - 2, top - ch, 4, ch);
      g.beginPath(); g.moveTo(cx - 7, top - ch - 9); g.lineTo(cx + 7, top - ch - 9); g.lineTo(cx + 3, top - ch); g.lineTo(cx - 3, top - ch); g.closePath(); g.fill();
    }
    if (wins) for (let fy = top + 14; fy < baseY - 24; fy += 30) for (let fx = x + 8; fx < x + bw - 14; fx += 18) {
      if (r() < 0.16) wins.push({ x: fx, y: fy, w: 8, h: 15, arch: true, ph: r() * TAU });
    }
    x += bw + 2 + r() * 6;
  }
}
const venice: Theme = {
  id: 'italy/venice',
  terrain: {
    outline: '#150f22', stone: '#5a3a3d', stoneLight: '#6b4645', stoneHighlight: 'rgba(255,200,170,.12)', speck: '#3b2428',
    underside: 'rgba(25,14,30,.75)', grass: '#9c958f', grassLight: '#cfc6b8', grassBlade: '#8a827c', flowers: [],
    masonry: 'bricks', mortar: '#3a2328', top: 'ledge', ledge: '#a9a1a0', ledgeLight: '#d8cfc2',
    plank: ['#a5703f', '#5f3a20', '#c99258'], plankDots: [],
  },
  paintBackground(g, w, h) {
    nightSky(g, w, h, ['#101a3e', '#22306a', '#40407a', '#6a4f7c'], 31, 120);
    crescent(g, w * 0.16, h * 0.15, 22, '#121c42');
    // кампаніла й куполи вдалині
    g.fillStyle = '#2c3164';
    const cx = w * 0.34, ct = h * 0.2;
    g.fillRect(cx - 16, ct + 60, 32, h); g.fillRect(cx - 19, ct + 56, 38, 8);
    g.fillRect(cx - 15, ct + 22, 30, 36);
    g.beginPath(); g.moveTo(cx - 17, ct + 24); g.lineTo(cx, ct - 18); g.lineTo(cx + 17, ct + 24); g.closePath(); g.fill();
    g.fillStyle = '#40457a'; for (const dx of [-9, 0, 9]) g.fillRect(cx + dx - 2.5, ct + 28, 5, 18);
    g.fillStyle = '#2c3164';
    for (const [dx, rad] of [[0.66, 46], [0.73, 30], [0.6, 26]] as [number, number][]) {
      const dxp = w * dx, dy = h * 0.5;
      g.beginPath(); g.ellipse(dxp, dy, rad, rad * 0.95, 0, Math.PI, 0); g.fill();
      g.fillRect(dxp - rad, dy, rad * 2, h); g.fillRect(dxp - 3, dy - rad - 14, 6, 16);
      circ(g, dxp, dy - rad - 16, 4); g.fill();
    }
    mist(g, w, h * 0.56, '170,160,230', 0.06);
    veniceWins.length = 0;
    venetianRow(g, w, h, h * 0.66, '#232650', 41, 130, null);
    mist(g, w, h * 0.7, '170,160,230', 0.05);
    venetianRow(g, w, h, h * 0.8, '#1a1b40', 57, 170, veniceWins);
    for (const wd of veniceWins) { g.fillStyle = 'rgba(255,196,122,.16)'; windowShape(g, wd); g.fill(); }
  },
  drawAmbient(g, t, w, h) {
    drawTwinkles(g, veniceTw, t, w, h);
    drawWindows(g, veniceWins, t);
  },
};
const veniceTw = twinkleStars(301);

// ===== Франція: нічні дахи Парижа =====
const parisWins: Win[] = [];
const towerSparks: { x: number; y: number; ph: number }[] = [];
function parisRow(g: G, w: number, h: number, baseY: number, color: string, seed: number, tall: number, wins: Win[] | null) {
  const r = mulberry32(seed);
  g.fillStyle = color;
  for (let x = -20; x < w + 20;) {
    const bw = 70 + r() * 80, bh = tall * (0.55 + r() * 0.45), top = baseY - bh, roof = 22 + r() * 10;
    g.fillRect(x, top, bw, h - top);
    // мансардний дах із віконцями
    g.beginPath(); g.moveTo(x - 2, top); g.lineTo(x + 10, top - roof); g.lineTo(x + bw - 10, top - roof); g.lineTo(x + bw + 2, top); g.closePath(); g.fill();
    for (let dx = x + 18; dx < x + bw - 22; dx += 26) {
      g.fillRect(dx, top - roof + 6, 10, 12);
      g.beginPath(); g.moveTo(dx - 2, top - roof + 7); g.lineTo(dx + 5, top - roof); g.lineTo(dx + 12, top - roof + 7); g.closePath(); g.fill();
      if (wins && r() < 0.3) wins.push({ x: dx + 2, y: top - roof + 9, w: 6, h: 8, arch: false, ph: r() * TAU });
    }
    // комини з глиняними горщиками
    const sx = x + 12 + r() * (bw - 40), sw = 18 + r() * 10;
    g.fillRect(sx, top - roof - 16, sw, 18);
    for (let k = 0; k < 3; k++) g.fillRect(sx + 2 + k * (sw / 3), top - roof - 22, 4, 7);
    if (wins) for (let fy = top + 12; fy < baseY - 20; fy += 26) for (let fx = x + 9; fx < x + bw - 14; fx += 17) {
      if (r() < 0.14) wins.push({ x: fx, y: fy, w: 7, h: 13, arch: false, ph: r() * TAU });
    }
    x += bw + 4 + r() * 8;
  }
}
function eiffel(g: G, x: number, base: number, ht: number, color: string) {
  const half = ht * 0.24, leg = (k: number) => half * Math.pow(1 - k, 2.2) + 3 * (1 - k) + 2;
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x - half, base);
  for (let k = 0; k <= 1.0001; k += 0.05) g.lineTo(x - leg(k), base - ht * k);
  for (let k = 1; k >= -0.0001; k -= 0.05) g.lineTo(x + leg(k), base - ht * k);
  g.closePath(); g.fill();
  g.fillRect(x - 1.2, base - ht - 18, 2.4, 20);
  g.fillStyle = 'rgba(14,18,48,.9)';
  g.beginPath(); g.ellipse(x, base, half * 0.62, ht * 0.16, 0, Math.PI, 0); g.fill(); // арка між ногами
  for (const k of [0.27, 0.55]) { g.fillStyle = color; g.fillRect(x - leg(k) - 5, base - ht * k - 4, leg(k) * 2 + 10, 6); }
  g.strokeStyle = 'rgba(14,18,48,.55)'; g.lineWidth = 1;
  for (let k = 0.04; k < 0.9; k += 0.06) {
    const y0 = base - ht * k, y1 = base - ht * (k + 0.06);
    g.beginPath(); g.moveTo(x - leg(k), y0); g.lineTo(x + leg(k + 0.06), y1); g.moveTo(x + leg(k), y0); g.lineTo(x - leg(k + 0.06), y1); g.stroke();
  }
  towerSparks.length = 0;
  const r = mulberry32(88);
  for (let i = 0; i < 70; i++) { const k = Math.pow(r(), 1.3) * 0.98, s = r() * 2 - 1; towerSparks.push({ x: x + s * leg(k) * 0.9, y: base - ht * k, ph: r() * TAU }); }
  // теплі вогні вздовж ребер
  g.fillStyle = 'rgba(255,196,120,.45)';
  for (let k = 0; k < 1; k += 0.035) { circ(g, x - leg(k), base - ht * k, 0.9); g.fill(); circ(g, x + leg(k), base - ht * k, 0.9); g.fill(); }
}
const paris: Theme = {
  id: 'france/paris',
  terrain: {
    outline: '#120f24', stone: '#4c4860', stoneLight: '#585470', stoneHighlight: 'rgba(200,210,255,.12)', speck: '#363249',
    underside: 'rgba(20,16,40,.75)', grass: '#6f7d93', grassLight: '#9fb0c6', grassBlade: '#5e6b80', flowers: [],
    masonry: 'bricks', mortar: '#38344a', top: 'ledge', ledge: '#6f7d93', ledgeLight: '#aab9cf',
    plank: ['#9a7650', '#57402a', '#c09a6c'], plankDots: [],
  },
  paintBackground(g, w, h) {
    nightSky(g, w, h, ['#0d1130', '#20275a', '#373470', '#584272'], 61, 110);
    crescent(g, w * 0.2, h * 0.13, 20, '#0f1434');
    eiffel(g, w * 0.76, h * 0.86, h * 0.66, '#2d2c5c');
    mist(g, w, h * 0.6, '170,160,230', 0.06);
    parisWins.length = 0;
    parisRow(g, w, h, h * 0.72, '#24275a', 71, 120, null);
    mist(g, w, h * 0.75, '170,160,230', 0.05);
    parisRow(g, w, h, h * 0.86, '#1a1b42', 83, 150, parisWins);
    for (const wd of parisWins) { g.fillStyle = 'rgba(255,196,122,.16)'; windowShape(g, wd); g.fill(); }
  },
  drawAmbient(g, t, w, h) {
    drawTwinkles(g, parisTw, t, w, h);
    drawWindows(g, parisWins, t);
    // вежа раз на пів хвилини кілька секунд мерехтить вогниками, як справжня щогодини
    const cyc = t % 30;
    if (cyc < 5) {
      const fade = Math.min(1, cyc, 5 - cyc);
      g.globalCompositeOperation = 'lighter';
      for (const sp of towerSparks) {
        const a = Math.max(0, Math.sin(t * 13 + sp.ph * 7)) * 0.7 * fade;
        if (a < 0.1) continue;
        g.globalAlpha = a; g.fillStyle = '#fffbe8'; star4(g, sp.x, sp.y, 2.4, 0); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  },
};
const parisTw = twinkleStars(401);

const THEMES: Record<string, Theme> = { [kupala.id]: kupala, [venice.id]: venice, [paris.id]: paris };
export const getTheme = (id: string): Theme => THEMES[id] ?? kupala;
