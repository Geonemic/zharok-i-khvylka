import { type G, TAU, circ, star4, drawGlow } from './draw';

// Частинки — лише окраса: випадковість тут дозволена, симуляцію вони не зачіпають
export interface Particle {
  type: 'dot' | 'steam' | 'ring' | 'spark' | 'star';
  x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; max: number; size: number; grow: number; col: string;
  add: boolean; sprite?: HTMLCanvasElement; rot: number; vr: number;
}
export type EmitOpts = Partial<Pick<Particle, 'vx' | 'vy' | 'g' | 'drag' | 'life' | 'size' | 'grow' | 'col' | 'add' | 'sprite' | 'vr'>>;

export class Particles {
  list: Particle[] = [];
  emit(type: Particle['type'], x: number, y: number, o: EmitOpts = {}) {
    if (this.list.length > 1400) return;
    const life = o.life ?? 40;
    this.list.push({
      type, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, drag: o.drag ?? 1, life, max: life,
      size: o.size ?? 2, grow: o.grow ?? 0, col: o.col ?? '#fff', add: !!o.add, sprite: o.sprite, rot: Math.random() * TAU, vr: o.vr ?? 0,
    });
  }
  update() {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.size += p.grow; p.rot += p.vr;
      if (--p.life <= 0) { l[i] = l[l.length - 1]; l.pop(); }
    }
  }
  clear() { this.list.length = 0; }
  draw(g: G) {
    for (const p of this.list) {
      if (p.add) continue;
      const a = p.life / p.max;
      g.globalAlpha = p.type === 'steam' ? a * 0.4 : Math.min(1, a * 1.5);
      g.fillStyle = p.col; g.strokeStyle = p.col;
      if (p.type === 'ring') { g.lineWidth = 1.3; circ(g, p.x, p.y, p.size); g.stroke(); }
      else { circ(g, p.x, p.y, p.size); g.fill(); }
    }
    g.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      if (!p.add) continue;
      const a = p.life / p.max;
      if (p.sprite) drawGlow(g, p.sprite, p.x, p.y, p.size * 4, a * 0.6);
      g.globalAlpha = a; g.fillStyle = p.col;
      if (p.type === 'star') star4(g, p.x, p.y, p.size * 2, p.rot); else circ(g, p.x, p.y, p.size * 0.6);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
}
