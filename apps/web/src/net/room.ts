import { useSyncExternalStore } from 'react';
import {
  ROOM_CODE_CHARS, ROOM_CODE_LEN, decodeGame, encodeGame, isGameRaw,
  type ClientMsg, type GameMsg, type JoinError, type Phase, type PlayerInfo, type ServerMsg,
} from '@zh/protocol';

export interface ChatLine { id: number; from: number; name: string; text: string; at: number }

export interface RoomView {
  status: 'connecting' | 'open' | 'closed';
  error: JoinError | 'network' | null;
  code: string;
  you: number;
  players: PlayerInfo[];
  level: string;
  phase: Phase;
  game: { epoch: number; level: string } | null; // поточний запуск рівня
  partnerLeft: boolean;
  chat: ChatLine[];
  ping: number | null; // мс до сервера й назад
}

export function newRoomCode(): string {
  const r = crypto.getRandomValues(new Uint32Array(ROOM_CODE_LEN));
  return Array.from(r, (v) => ROOM_CODE_CHARS[v % ROOM_CODE_CHARS.length]).join('');
}

// З'єднання з кімнатою на сервері. React читає його стан через useRoom().
export class RoomClient {
  private ws: WebSocket;
  private listeners = new Set<() => void>();
  private pingTimer = 0;
  private pingSent = 0;
  private chatId = 0;
  view: RoomView;
  // натискання й відбитки партнера йдуть до рушія поточного запуску рівня (epoch);
  // ті, що прийшли раніше, ніж рушій запустився, чекають у черзі
  private gameEpoch = -1;
  private gameHandler: ((m: GameMsg) => void) | null = null;
  private pending: GameMsg[] = [];

  constructor(code: string, name: string, mode: 'create' | 'join') {
    this.view = { status: 'connecting', error: null, code, you: 0, players: [], level: 'ua-1', phase: 'lobby', game: null, partnerLeft: false, chat: [], ping: null };
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const q = new URLSearchParams({ name, mode, v: __BUILD__ });
    this.ws = new WebSocket(`${proto}://${location.host}/api/room/${code}/ws?${q}`);
    this.ws.onopen = () => {
      this.set({ status: 'open' });
      this.pingTimer = window.setInterval(() => this.ping(), 2000);
      this.ping();
    };
    this.ws.onmessage = (e) => this.onMessage(String(e.data));
    this.ws.onclose = () => {
      clearInterval(this.pingTimer);
      this.set({ status: 'closed', error: this.view.error ?? (this.view.status === 'connecting' ? 'network' : null) });
    };
  }

  private ping() {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.pingSent = performance.now();
    this.ws.send('ping');
  }

  private onMessage(raw: string) {
    if (raw === 'pong') { this.set({ ping: Math.round(performance.now() - this.pingSent) }); return; }
    if (isGameRaw(raw)) {
      const g = decodeGame(raw);
      if (!g) return;
      if (g.epoch === this.gameEpoch && this.gameHandler) this.gameHandler(g);
      else if (g.epoch > this.gameEpoch) this.pending.push(g);
      return;
    }
    let m: ServerMsg;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'room': {
        const { code, you, players, level, phase } = m;
        this.set({ code, you, players, level, phase, ...(players.length > 1 ? { partnerLeft: false } : {}) });
        break;
      }
      case 'start': this.set({ game: { epoch: m.epoch, level: m.level }, phase: 'game' }); break;
      case 'lobby': this.set({ game: null, phase: 'lobby', partnerLeft: !!m.left }); break;
      case 'chat': {
        const line: ChatLine = { id: ++this.chatId, from: m.from, name: m.name, text: m.text, at: Date.now() };
        this.set({ chat: [...this.view.chat.slice(-60), line] });
        break;
      }
      case 'error': this.set({ error: m.code }); break;
    }
  }

  private set(p: Partial<RoomView>) {
    this.view = { ...this.view, ...p };
    this.listeners.forEach((f) => f());
  }

  claimGame(epoch: number, handler: (m: GameMsg) => void) {
    this.gameEpoch = epoch;
    this.gameHandler = handler;
    const mine = this.pending.filter((m) => m.epoch === epoch);
    this.pending = this.pending.filter((m) => m.epoch > epoch);
    mine.forEach(handler);
  }
  releaseGame(epoch: number) { if (this.gameEpoch === epoch) this.gameHandler = null; }
  sendGame(m: GameMsg) { this.sendRaw(encodeGame(m)); }

  send(m: ClientMsg) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  sendRaw(s: string) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s); }
  close() { clearInterval(this.pingTimer); this.ws.close(1000, 'leave'); }

  // мій герой: 0 — Жарок, 1 — Хвилька
  get hero(): 0 | 1 { return this.view.players.find((p) => p.slot === this.view.you)?.hero ?? 0; }

  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  getView = () => this.view;
}

const EMPTY = () => () => {};
export function useRoom(c: RoomClient | null): RoomView | null {
  return useSyncExternalStore(c ? c.subscribe : EMPTY, () => (c ? c.view : null));
}
