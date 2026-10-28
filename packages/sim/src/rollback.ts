import type { Level } from './level';
import { cloneState, createState, hashState, type SimState } from './state';
import { step, type SimEvent } from './step';

// Rollback-неткод для двох гравців.
// Кожен рахує гру сам. Свій герой реагує одразу (з маленькою затримкою delay кроків, щоб партнер
// встиг отримати натискання), а натискання партнера, яких ще немає, передбачаються: «тримає те саме».
// Коли справжні натискання приходять і відрізняються від передбачених, гра відкочується до
// останнього підтвердженого стану й швидко перераховується. Мережею ходять лише зміни натискань.

export const MAX_PREDICT = 15; // далі не забігаємо: чекаємо на партнера (0,25 с)
export const HEARTBEAT = 4; // навіть без змін нагадуємо про себе кожні 4 кроки
export const HASH_EVERY = 120; // раз на 2 с звіряємо відбиток стану

export type NetOut =
  | { kind: 'input'; tick: number; input: number; adv: number } // моє натискання на кроці tick (і незмінне до нього)
  | { kind: 'hash'; tick: number; hash: number };

export class Rollback {
  state: SimState; // поточний стан із передбаченнями — його малюємо
  private confirmed: SimState; // стан, у якому відомі всі натискання обох
  private local: number[] = []; // local[n] — моє натискання для кроку n
  private remote: number[] = []; // remote[n] — справжнє натискання партнера
  private used: number[] = []; // used[n] — що ми передбачили за партнера для кроку n
  private lastRemote = 0;
  private lastSentT = 0;
  private lastSentV = 0;
  private hashes = new Map<number, number>(); // мої відбитки підтверджених кроків
  private theirHashes = new Map<number, number>();
  remoteKnown = 0; // до якого кроку натискання партнера вже відомі
  remoteAdv = 0; // наскільки партнер, за його словами, забіг уперед
  rollbacks = 0;
  desync = -1; // крок, на якому стани розійшлися (-1 — усе гаразд)

  private L: Level;
  readonly me: 0 | 1;
  readonly delay: number;
  private out: (m: NetOut) => void;

  constructor(L: Level, me: 0 | 1, out: (m: NetOut) => void, delay = 2) {
    this.L = L;
    this.me = me;
    this.out = out;
    this.delay = delay;
    this.state = createState(L);
    this.confirmed = cloneState(this.state);
    for (let n = 1; n <= delay; n++) this.local[n] = 0;
  }

  get tick() { return this.state.tick; }
  get confirmedState(): SimState { return this.confirmed; }
  // наскільки мій стан випереджає відоме від партнера (разом із затримкою мережі)
  get localAdv() { return this.state.tick - this.remoteKnown; }
  get stalled() { return this.state.tick - this.remoteKnown >= MAX_PREDICT; }

  // Від партнера: на кроці t натискання v, а між попереднім повідомленням і t — без змін
  receiveInput(t: number, v: number, adv: number) {
    if (t <= this.remoteKnown) return;
    for (let n = this.remoteKnown + 1; n < t; n++) this.remote[n] = this.lastRemote;
    this.remote[t] = v;
    this.remoteKnown = t;
    this.lastRemote = v;
    this.remoteAdv = adv;
  }

  receiveHash(t: number, h: number) {
    this.theirHashes.set(t, h);
    this.checkHash(t);
  }

  private checkHash(t: number) {
    const a = this.hashes.get(t), b = this.theirHashes.get(t);
    if (a === undefined || b === undefined) return;
    if (a !== b && this.desync < 0) this.desync = t;
    this.hashes.delete(t);
    this.theirHashes.delete(t);
  }

  private pair(n: number, r: number): [number, number] {
    const l = this.local[n] ?? 0;
    return this.me === 0 ? [l, r] : [r, l];
  }

  // Просуває підтверджений стан; якщо передбачення десь не справдилося — перераховує решту
  update() {
    const upto = Math.min(this.remoteKnown, this.state.tick);
    let wrong = false;
    while (this.confirmed.tick < upto) {
      const n = this.confirmed.tick + 1;
      if (this.used[n] !== this.remote[n]) wrong = true;
      step(this.confirmed, this.L, this.pair(n, this.remote[n]));
      if (n % HASH_EVERY === 0) {
        const h = hashState(this.confirmed);
        this.hashes.set(n, h);
        this.out({ kind: 'hash', tick: n, hash: h });
        this.checkHash(n);
      }
    }
    if (!wrong) return;
    this.rollbacks++;
    const s = cloneState(this.confirmed);
    while (s.tick < this.state.tick) {
      const n = s.tick + 1, r = n <= this.remoteKnown ? this.remote[n] : this.lastRemote;
      this.used[n] = r;
      step(s, this.L, this.pair(n, r));
    }
    this.state = s;
  }

  // Один крок гри з моїм натисканням (воно спрацює через delay кроків). ev — події нового кроку.
  advance(input: number, ev: SimEvent[] = []): SimEvent[] {
    const n = this.state.tick + 1, t = n + this.delay;
    this.local[t] = input;
    if (input !== this.lastSentV || t - this.lastSentT >= HEARTBEAT) {
      this.lastSentT = t;
      this.lastSentV = input;
      this.out({ kind: 'input', tick: t, input, adv: this.localAdv });
    }
    const r = n <= this.remoteKnown ? this.remote[n] : this.lastRemote;
    this.used[n] = r;
    return step(this.state, this.L, this.pair(n, r), ev);
  }
}
