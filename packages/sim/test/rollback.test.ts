import { describe, expect, it } from 'vitest';
import { findLevel } from '@zh/levels';
import { Rollback, compileLevel, createState, hashState, step, type NetOut, type SimState } from '../src';

const L = compileLevel(findLevel('it-1')!);

// Двоє гравців із несправжньою мережею: повідомлення приходять із затримкою (у кроках) і нерівномірно
function play(opts: { frames: number; latency: number; jitter: number; seed: number; startGap?: number }) {
  let a = opts.seed;
  const rnd = () => { a = (Math.imul(a, 1103515245) + 12345) | 0; return ((a >>> 16) & 0x7fff) / 0x8000; };
  const hashes: Map<number, number>[] = [new Map(), new Map()];
  const queues: { at: number; m: NetOut }[][] = [[], []]; // queues[i] — що летить до гравця i
  let now = 0;
  const peers = [0, 1].map((me) => new Rollback(L, me as 0 | 1, (m) => {
    if (m.kind === 'hash') hashes[me].set(m.tick, m.hash);
    const lag = opts.latency + Math.floor(rnd() * opts.jitter);
    const q = queues[1 - me];
    q.push({ at: Math.max(now + lag, q.length ? q[q.length - 1].at : 0), m }); // WebSocket не міняє порядок
  }));
  const truth: number[][] = [[], []]; // справжні натискання кожного по кроках
  const cur = [0, 0];
  const deliver = (i: number) => {
    const q = queues[i];
    while (q.length && q[0].at <= now) {
      const { m } = q.shift()!;
      if (m.kind === 'input') peers[i].receiveInput(m.tick, m.input, m.adv);
      else peers[i].receiveHash(m.tick, m.hash);
    }
  };
  let maxRollbacks = 0;
  for (now = 0; now < opts.frames; now++) {
    for (let i = 0; i < 2; i++) {
      if (i === 1 && now < (opts.startGap ?? 0)) continue; // другий гравець почав трохи пізніше
      deliver(i);
      const p = peers[i];
      p.update();
      if (p.stalled) continue;
      if (now % 7 === 0) cur[i] = Math.floor(rnd() * 16);
      const input = now > opts.frames - 200 ? 0 : cur[i];
      truth[i][p.tick + 1 + p.delay] = input;
      p.advance(input);
    }
    maxRollbacks = Math.max(maxRollbacks, peers[0].rollbacks, peers[1].rollbacks);
  }
  // мережа доносить усе, що ще летить
  now = Infinity;
  for (let i = 0; i < 2; i++) { deliver(i); peers[i].update(); }
  // еталон: та сама гра без мережі, з усіма справжніми натисканнями
  const ref: SimState = createState(L);
  const refHash = new Map<number, number>();
  const end = Math.min(peers[0].confirmedState.tick, peers[1].confirmedState.tick);
  for (let n = 1; n <= end; n++) {
    step(ref, L, [truth[0][n] ?? 0, truth[1][n] ?? 0]);
    if (n % 120 === 0) refHash.set(n, hashState(ref));
  }
  return { peers, hashes, refHash, end, maxRollbacks };
}

describe('rollback-неткод', () => {
  it('обидва гравці бачать ту саму гру, що й без мережі', () => {
    const { peers, hashes, refHash, end, maxRollbacks } = play({ frames: 3000, latency: 6, jitter: 5, seed: 3 });
    expect(end).toBeGreaterThan(2500);
    expect(maxRollbacks).toBeGreaterThan(10); // передбачення справді іноді помилялися
    for (const [t, h] of refHash) {
      expect(hashes[0].get(t)).toBe(h);
      expect(hashes[1].get(t)).toBe(h);
    }
    expect(peers[0].desync).toBe(-1);
    expect(peers[1].desync).toBe(-1);
  });

  it('витримує велику затримку й гравця, що почав пізніше', () => {
    const { peers, hashes, refHash, end } = play({ frames: 3000, latency: 14, jitter: 9, seed: 11, startGap: 20 });
    expect(end).toBeGreaterThan(2000);
    for (const [t, h] of refHash) expect(hashes[0].get(t)).toBe(h);
    expect(peers[0].desync).toBe(-1);
    expect(peers[1].desync).toBe(-1);
  });

  it('після тиші передбачений стан збігається з підтвердженим', () => {
    const { peers } = play({ frames: 1500, latency: 4, jitter: 3, seed: 5 });
    for (const p of peers) {
      expect(p.confirmedState.tick).toBe(p.state.tick);
      expect(hashState(p.state)).toBe(hashState(p.confirmedState));
    }
  });
});
