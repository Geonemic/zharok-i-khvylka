import { TILE_PX, type LevelData } from '@zh/levels';
import { type G, TAU, mulberry32, rr, ell, circ } from './draw';
import type { Pool, PoolKind } from './objects';

const T = TILE_PX;

// Кольори землі — кожна тема країни має свої
export interface TerrainPalette {
  outline: string;
  stone: string;
  stoneLight: string;
  stoneHighlight: string;
  speck: string;
  underside: string;
  grass: string;
  grassLight: string;
  grassBlade: string;
  flowers: string[];
  masonry?: 'rocks' | 'bricks'; // кругляки (за замовчуванням) чи цегла
  mortar?: string; // колір швів цегли
  top?: 'grass' | 'ledge'; // трава з квітами чи кам'яний карниз
  ledge?: string;
  ledgeLight?: string;
  plank?: [string, string, string]; // дошки: верх, низ, відблиск
  plankDots?: string[]; // розпис на дошках
}

const brickRows = 4, brickW = 20;

export function findPools(level: LevelData): Pool[] {
  const pools: Pool[] = [];
  level.tiles.forEach((row, r) => {
    for (let c = 0; c < row.length;) {
      const ch = row[c];
      if (ch !== 'F' && ch !== 'W' && ch !== 'B') { c++; continue; }
      let e = c;
      while (e + 1 < row.length && row[e + 1] === ch) e++;
      pools.push({ kind: ch as PoolKind, x0: c * T, x1: (e + 1) * T, y: r * T, bubbles: [] });
      c = e + 1;
    }
  });
  return pools;
}

// Статична земля малюється один раз у шар, а далі лише копіюється
export function paintTerrain(g: G, level: LevelData, pools: Pool[], pal: TerrainPalette): void {
  const rows = level.tiles.length, cols = level.tiles[0].length;
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? '#' : level.tiles[r][c]);
  const solidish = (c: number, r: number) => '#FWB'.includes(at(c, r));
  const radii = (c: number, r: number, rad: number) => {
    const L = !solidish(c - 1, r), R = !solidish(c + 1, r), U = !solidish(c, r - 1), D = !solidish(c, r + 1);
    return [L && U ? rad : 0, R && U ? rad : 0, R && D ? rad : 0, L && D ? rad : 0];
  };
  const forTiles = (fn: (ch: string, c: number, r: number, x: number, y: number) => void) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) fn(level.tiles[r][c], c, r, c * T, r * T);
  };
  // 1) темний контур — трохи збільшені плитки під основними
  g.fillStyle = pal.outline;
  forTiles((ch, c, r, x, y) => {
    if (ch === '#') { rr(g, x - 3, y - 3, T + 6, T + 6, radii(c, r, 12)); g.fill(); }
    else if ('FWB'.includes(ch)) g.fillRect(x - 3, y + 3, T + 6, T);
    else if (ch === '=') { rr(g, x - 2.5, y - 2.5, T + 5, 17, 5); g.fill(); }
  });
  // 2) камінь
  const rand = mulberry32(5);
  forTiles((ch, c, r, x, y) => {
    if (ch === '#') {
      const rad = radii(c, r, 9);
      g.fillStyle = pal.stone; rr(g, x, y, T, T, rad); g.fill();
      if (pal.masonry === 'bricks') {
        // цегла кладеться наскрізь через тайли, тож шви збігаються
        g.save(); rr(g, x, y, T, T, rad); g.clip();
        const bh = T / brickRows;
        for (let k = 0; k < brickRows; k++) {
          const by = y + k * bh, shift = ((r * brickRows + k) % 2) * (brickW / 2);
          for (let bx = x - shift; bx < x + T; bx += brickW) {
            if (rand() < 0.3) { g.fillStyle = pal.stoneLight; g.fillRect(bx + 1, by + 1, brickW - 2, bh - 2); }
          }
          g.fillStyle = pal.mortar ?? pal.speck;
          g.fillRect(x, by + bh - 1, T, 1.2);
          for (let bx = x - shift; bx < x + T; bx += brickW) g.fillRect(bx, by, 1.2, bh);
        }
        g.fillStyle = pal.stoneHighlight; g.fillRect(x, y, T, 2);
        g.restore();
      } else for (let i = 0; i < 3; i++) {
        const sx = x + 8 + rand() * 24, sy = y + 10 + rand() * 22, w = 4 + rand() * 5, h = 3 + rand() * 3;
        g.fillStyle = pal.stoneLight; ell(g, sx, sy, w, h); g.fill();
        g.fillStyle = pal.stoneHighlight; ell(g, sx - 1, sy - h * 0.45, w * 0.6, h * 0.35); g.fill();
      }
      g.fillStyle = pal.speck;
      if (pal.masonry !== 'bricks') for (let i = 0; i < 3; i++) { circ(g, x + 5 + rand() * 30, y + 6 + rand() * 30, 0.9 + rand() * 0.8); g.fill(); }
      if (!solidish(c, r + 1)) {
        const sh = g.createLinearGradient(0, y + T - 12, 0, y + T);
        sh.addColorStop(0, 'rgba(25,18,45,0)'); sh.addColorStop(1, pal.underside);
        g.fillStyle = sh; rr(g, x, y + T - 12, T, 12, [0, 0, rad[2], rad[3]]); g.fill();
      }
    } else if ('FWB'.includes(ch)) {
      g.fillStyle = pal.stone; g.fillRect(x, y + 6, T, T - 6);
    }
  });
  for (const p of pools) { g.fillStyle = '#1c1630'; g.fillRect(p.x0 + 2, p.y + 6, p.x1 - p.x0 - 4, T - 9); }
  // 3) трава й квіточки на відкритих верхах (або кам'яний карниз у містах)
  forTiles((ch, c, r, x, y) => {
    if (ch !== '#' || solidish(c, r - 1) || at(c, r - 1) === '=') return;
    const [tl, tr] = radii(c, r, 9);
    if (pal.top === 'ledge') {
      const l = !solidish(c - 1, r) || at(c - 1, r - 1) === '#' ? 2 : 0, rgt = !solidish(c + 1, r) || at(c + 1, r - 1) === '#' ? 2 : 0;
      g.fillStyle = pal.outline; rr(g, x - l - 1, y - 3, T + l + rgt + 2, 10, [tl ? 5 : 0, tr ? 5 : 0, 3, 3]); g.fill();
      g.fillStyle = pal.ledge ?? pal.stoneLight; rr(g, x - l, y - 2, T + l + rgt, 8, [tl ? 4 : 0, tr ? 4 : 0, 2, 2]); g.fill();
      g.fillStyle = pal.ledgeLight ?? pal.stoneHighlight; g.fillRect(x - l + (tl ? 3 : 0), y - 2, T + l + rgt - (tl ? 3 : 0) - (tr ? 3 : 0), 2);
      return;
    }
    g.fillStyle = pal.grass; rr(g, x, y - 2, T, 10, [tl, tr, 0, 0]); g.fill();
    g.beginPath(); g.moveTo(x + (tl ? 4 : 0), y + 6);
    for (let k = 0; k <= 8; k++) g.lineTo(x + k * 5, y + 7 + (k % 2 ? 3 + rand() * 3 : 0));
    g.lineTo(x + T - (tr ? 4 : 0), y + 6); g.closePath(); g.fill();
    g.fillStyle = pal.grassLight; g.fillRect(x + (tl ? 6 : 0), y - 2, T - (tl ? 6 : 0) - (tr ? 6 : 0), 2.5);
    g.strokeStyle = pal.grassBlade; g.lineWidth = 1.4; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const bx = x + 4 + rand() * 32; g.beginPath(); g.moveTo(bx, y - 1); g.lineTo(bx + (rand() - 0.5) * 3, y - 4 - rand() * 4); g.stroke(); }
    if (rand() < 0.38) {
      const fx = x + 6 + rand() * 28, col = pal.flowers[Math.floor(rand() * pal.flowers.length)];
      g.strokeStyle = pal.grassBlade; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, y); g.lineTo(fx, y - 6); g.stroke();
      g.fillStyle = col;
      for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; circ(g, fx + Math.cos(a) * 1.9, y - 7 + Math.sin(a) * 1.9, 1.5); g.fill(); }
      g.fillStyle = '#ffcf3a'; circ(g, fx, y - 7, 1.1); g.fill();
    }
  });
  // 4) дерев'яні платформи; там, де край висить у повітрі, — мотузка до стелі
  forTiles((ch, c, r, x, y) => {
    if (ch !== '=') return;
    const L = at(c - 1, r) !== '=', R = at(c + 1, r) !== '=';
    const [pl, pd, ph] = pal.plank ?? ['#b47a45', '#6e4426', '#d29a5e'];
    const grd = g.createLinearGradient(0, y, 0, y + 12);
    grd.addColorStop(0, pl); grd.addColorStop(1, pd);
    g.fillStyle = grd; rr(g, x, y, T, 12, [L ? 4 : 0, R ? 4 : 0, R ? 4 : 0, L ? 4 : 0]); g.fill();
    g.fillStyle = ph; g.fillRect(x + (L ? 3 : 0), y, T - (L ? 3 : 0) - (R ? 3 : 0), 2);
    if (!L) { g.fillStyle = '#4a2c16'; g.fillRect(x, y + 1, 1.2, 10); }
    const dots = pal.plankDots ?? ['#e8364a', '#ffd23f', '#3fbf5f'];
    dots.forEach((col, i) => { g.fillStyle = col; circ(g, x + T / 2 + (i - (dots.length - 1) / 2) * 6, y + 6.5, 1.8); g.fill(); });
    for (const [end, ex, nc] of [[L, x + 5, c - 1], [R, x + T - 5, c + 1]] as [boolean, number, number][]) {
      if (!end || solidish(nc, r)) continue;
      let r0 = r - 1;
      while (r0 >= 0 && at(c, r0) !== '#') r0--;
      const top = (r0 + 1) * T;
      g.strokeStyle = '#3a2614'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, y + 2); g.stroke();
      g.strokeStyle = '#c9a46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, y + 2); g.stroke();
      g.strokeStyle = 'rgba(80,50,20,.6)'; g.lineWidth = 1;
      for (let yy = top + 4; yy < y; yy += 6) { g.beginPath(); g.moveTo(ex - 1, yy); g.lineTo(ex + 1, yy + 3); g.stroke(); }
    }
  });
  // 5) очерет біля трясовини — щоб її не сплутати з водою навіть без кольору
  for (const p of pools) {
    if (p.kind !== 'B') continue;
    for (const [bx, s] of [[p.x0, -1], [p.x1, 1]]) {
      for (let k = 0; k < 4; k++) {
        const x = bx + s * (3 + k * 5), h = 22 + rand() * 18, lean = s * (2 + rand() * 4);
        g.strokeStyle = '#2a3315'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, p.y); g.quadraticCurveTo(x, p.y - h * 0.6, x + lean, p.y - h); g.stroke();
        g.strokeStyle = '#7d8c34'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, p.y); g.quadraticCurveTo(x, p.y - h * 0.6, x + lean, p.y - h); g.stroke();
        if (k % 2 === 0) { g.fillStyle = '#6b4423'; ell(g, x + lean * 0.85, p.y - h + 5, 2.4, 6, lean * 0.04); g.fill(); g.strokeStyle = '#2a1a0c'; g.lineWidth = 1; g.stroke(); }
      }
    }
  }
  // 6) спокійна дерев'яна балка над кожними воротами
  for (const gate of level.gates) {
    g.fillStyle = '#6e4426'; rr(g, gate.x - 56, gate.top - 22, 112, 18, 5); g.fill();
    g.strokeStyle = '#2c180c'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(40,22,10,.55)'; g.lineWidth = 1.2;
    for (const ly of [gate.top - 16, gate.top - 10]) { g.beginPath(); g.moveTo(gate.x - 50, ly); g.lineTo(gate.x + 50, ly); g.stroke(); }
  }
}
