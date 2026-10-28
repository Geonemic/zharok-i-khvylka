import { compileLevel, createState, step, rating, Rollback, type Level, type SimState, type SimEvent } from '@zh/sim';
import type { LevelData } from '@zh/levels';
import { Renderer, type Tr } from '../render/renderer';
import type { RoomClient } from '../net/room';
import { Keyboard } from './input';

export interface LevelResult { stars: number; diamond: boolean; gems: number; time: number }

// Онлайн: з ким і в якому запуску рівня граємо
export interface OnlineLink { room: RoomClient; epoch: number; onStatus: (s: NetStatus) => void }
export interface NetStatus { waiting: boolean; desync: boolean }

const STEP_MS = 1000 / 60;
const RESULTS_DELAY_TICKS = 60; // герої встигають зайти в двері
const WAIT_FRAMES = 20; // стільки кадрів без вістей від партнера — показуємо «чекаємо»

// Ігровий цикл: фіксований крок симуляції 60 разів на секунду, малювання — з кожним кадром екрана.
// Локально обидва герої з однієї клавіатури; онлайн — свій герой, а партнер приходить через rollback-неткод.
export class GameEngine {
  private L: Level;
  private local: SimState;
  private net: Rollback | null = null;
  private online: OnlineLink | null;
  private renderer: Renderer;
  private keyboard = new Keyboard();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private resultSent = false;
  private resizeObs: ResizeObserver;
  private onWin: (r: LevelResult) => void;
  private canvas: HTMLCanvasElement;
  private frameNo = 0;
  private stallFrames = 0;
  private advAvg = 0;
  private lastSkip = 0;
  private status: NetStatus = { waiting: false, desync: false };

  constructor(canvas: HTMLCanvasElement, data: LevelData, tr: Tr, onWin: (r: LevelResult) => void, online: OnlineLink | null = null) {
    this.canvas = canvas;
    this.onWin = onWin;
    this.online = online;
    this.L = compileLevel(data);
    this.local = createState(this.L);
    if (online) {
      const { room, epoch } = online;
      const net = new Rollback(this.L, room.hero, (m) => room.sendGame(m.kind === 'input'
        ? { k: 'i', epoch, tick: m.tick, input: m.input, adv: m.adv }
        : { k: 'h', epoch, tick: m.tick, hash: m.hash }));
      room.claimGame(epoch, (m) => { if (m.k === 'i') net.receiveInput(m.tick, m.input, m.adv); else net.receiveHash(m.tick, m.hash); });
      this.net = net;
    }
    this.renderer = new Renderer(canvas, this.L, tr);
    this.renderer.reset(this.state);
    this.resizeObs = new ResizeObserver(() => this.resize());
  }

  // стан, який зараз на екрані
  get state(): SimState { return this.net ? this.net.state : this.local; }

  setTr(tr: Tr) { this.renderer.setTr(tr); }

  start() {
    this.keyboard.attach();
    this.resizeObs.observe(this.canvas);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.keyboard.detach();
    this.resizeObs.disconnect();
    if (this.online) this.online.room.releaseGame(this.online.epoch);
  }

  // Онлайн гра не зупиняється: партнер грає далі
  setPaused(p: boolean) {
    this.paused = p && !this.net;
    this.keyboard.read(); // не переносити натискання з паузи в гру
  }

  restart() {
    if (this.net) return; // онлайн перезапуск іде через сервер, щоб почали обидва
    this.local = createState(this.L);
    this.renderer.reset(this.local);
    this.resultSent = false;
    this.acc = 0;
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.renderer.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
  }

  private frame = (now: number) => {
    this.acc += Math.min(100, now - this.last);
    this.last = now;
    this.frameNo++;
    if (this.paused) this.acc = 0;
    if (this.net) this.netSteps(this.net); else this.localSteps();
    const done = this.net ? this.net.confirmedState : this.local; // перемога — лише в підтвердженому стані
    if (done.won && !this.resultSent && done.tick - done.winTick >= RESULTS_DELAY_TICKS) {
      this.resultSent = true;
      this.onWin(rating(done, this.L));
    }
    this.renderer.render(this.state, this.acc / STEP_MS, now / 1000);
    this.raf = requestAnimationFrame(this.frame);
  };

  private localSteps() {
    let steps = 0;
    const events: SimEvent[] = [];
    while (this.acc >= STEP_MS && steps < 5) {
      events.length = 0;
      this.renderer.beforeStep(this.local);
      step(this.local, this.L, this.keyboard.read(), events);
      this.renderer.afterStep(this.local, events);
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === 5) this.acc = 0;
  }

  private netSteps(net: Rollback) {
    net.update();
    // синхронізація годинників: хто забіг уперед, зрідка пропускає крок, і обидва йдуть нога в ногу
    this.advAvg += (net.localAdv - net.remoteAdv - this.advAvg) * 0.1;
    let steps = 0;
    const events: SimEvent[] = [];
    while (this.acc >= STEP_MS && steps < 5) {
      if (net.stalled) { this.acc = Math.min(this.acc, STEP_MS); break; }
      if (this.advAvg > 2.5 && this.frameNo - this.lastSkip > 10) {
        this.lastSkip = this.frameNo;
        this.advAvg -= 2;
        this.acc -= STEP_MS;
        continue;
      }
      events.length = 0;
      this.renderer.beforeStep(net.state);
      const [a, b] = this.keyboard.read(); // онлайн своїм героєм керують і WASD, і стрілки
      net.advance(a | b, events);
      this.renderer.afterStep(net.state, events);
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.stallFrames = net.stalled ? this.stallFrames + 1 : 0;
    const status: NetStatus = { waiting: this.stallFrames > WAIT_FRAMES, desync: net.desync >= 0 };
    if (status.waiting !== this.status.waiting || status.desync !== this.status.desync) {
      this.status = status;
      this.online?.onStatus(status);
    }
  }
}
