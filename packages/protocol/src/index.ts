// Мережеві повідомлення між грою (apps/web) і сервером кімнат (apps/server).
// Службові повідомлення — JSON. Натискання й відбитки стану йдуть щокілька кроків, тож це короткі рядки,
// які сервер не розбирає, а лише пересилає партнерові.

export const MAX_NAME = 20;
export const MAX_CHAT = 240;
export const ROOM_CODE_LEN = 5;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без 0/O та 1/I, щоб не плутати
export const isRoomCode = (c: string) => c.length === ROOM_CODE_LEN && [...c].every((ch) => ROOM_CODE_CHARS.includes(ch));
export const isLevelId = (id: unknown): id is string => typeof id === 'string' && /^[a-z]{2}-\d{1,2}$/.test(id);

// Ім'я чи повідомлення без керувальних символів і зайвих пробілів
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += c < 32 || (c >= 0x7f && c < 0xa0) ? ' ' : ch;
  }
  return [...out.replace(/\s+/g, ' ').trim()].slice(0, max).join('');
}

export type Hero = 0 | 1; // 0 — Жарок, 1 — Хвилька
export interface PlayerInfo { slot: number; name: string; hero: Hero }
export type Phase = 'lobby' | 'game';
export type JoinError = 'full' | 'notfound' | 'taken' | 'version' | 'bad';

export type ServerMsg =
  | { t: 'room'; code: string; you: number; players: PlayerInfo[]; level: string; phase: Phase; epoch: number }
  | { t: 'chat'; from: number; name: string; text: string }
  | { t: 'start'; epoch: number; level: string }
  | { t: 'lobby'; left?: boolean }
  | { t: 'error'; code: JoinError };

export type ClientMsg =
  | { t: 'chat'; text: string }
  | { t: 'level'; id: string }
  | { t: 'swap' }
  | { t: 'start'; level?: string }
  | { t: 'lobby' };

// Швидкі повідомлення гри. epoch — номер запуску рівня: старі повідомлення після перезапуску відкидаються.
export type GameMsg =
  | { k: 'i'; epoch: number; tick: number; input: number; adv: number }
  | { k: 'h'; epoch: number; tick: number; hash: number };

export const isGameRaw = (s: string) => s.startsWith('i,') || s.startsWith('h,');

export function encodeGame(m: GameMsg): string {
  return m.k === 'i' ? `i,${m.epoch},${m.tick},${m.input},${m.adv}` : `h,${m.epoch},${m.tick},${m.hash}`;
}

export function decodeGame(s: string): GameMsg | null {
  const p = s.split(',');
  const n = p.slice(1).map(Number);
  if (n.some((v) => !Number.isInteger(v))) return null;
  if (p[0] === 'i' && n.length === 4) return { k: 'i', epoch: n[0], tick: n[1], input: n[2], adv: n[3] };
  if (p[0] === 'h' && n.length === 3) return { k: 'h', epoch: n[0], tick: n[1], hash: n[2] };
  return null;
}
