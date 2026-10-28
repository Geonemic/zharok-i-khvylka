import { DurableObject } from 'cloudflare:workers';
import {
  MAX_CHAT, MAX_NAME, cleanText, isGameRaw, isLevelId, isRoomCode,
  type ClientMsg, type Hero, type JoinError, type Phase, type PlayerInfo, type ServerMsg,
} from '@zh/protocol';

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

const DEFAULT_LEVEL = 'ua-1';

// Вхідна точка: /api/room/КОД/ws — кімната; усе інше віддає зібрана гра (Cloudflare робить це сам)
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/room\/([A-Z0-9]+)\/ws$/);
    if (m && isRoomCode(m[1])) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

interface Seat { slot: number; name: string }
interface RoomData { code: string; version: string; level: string; phase: Phase; epoch: number; swap: boolean }

// Одна кімната = один Durable Object. Він нічого не рахує: лише пересилає натискання між двома
// гравцями й тримає стан лобі. З'єднання «присипляються» між повідомленнями, тож простій нічого не коштує.
export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // на «ping» відповідає сама платформа, не будячи кімнату: так вимірюємо затримку безкоштовно
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private seats(except?: WebSocket): { ws: WebSocket; seat: Seat }[] {
    return this.ctx.getWebSockets()
      .filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN)
      .map((ws) => ({ ws, seat: ws.deserializeAttachment() as Seat }));
  }

  private async data(): Promise<RoomData | undefined> {
    return this.ctx.storage.get<RoomData>('room');
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.pathname.split('/')[3];
    const name = cleanText(url.searchParams.get('name'), MAX_NAME);
    const mode = url.searchParams.get('mode');
    const version = url.searchParams.get('v') ?? '';
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const others = this.seats();
    const room = await this.data();

    let error: JoinError | null = null;
    if (!name || (mode !== 'create' && mode !== 'join')) error = 'bad';
    else if (mode === 'create' && others.length) error = 'taken';
    else if (mode === 'join' && (!others.length || !room)) error = 'notfound';
    else if (others.length >= 2) error = 'full';
    else if (room && others.length && room.version !== version) error = 'version';
    if (error) {
      server.accept();
      server.send(JSON.stringify({ t: 'error', code: error } satisfies ServerMsg));
      server.close(4000, error);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (!others.length) {
      await this.ctx.storage.put<RoomData>('room', { code, version, level: DEFAULT_LEVEL, phase: 'lobby', epoch: 0, swap: false });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ slot: others.some((o) => o.seat.slot === 0) ? 1 : 0, name } satisfies Seat);
    await this.sendRoom();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== 'string') return;
    // натискання й відбитки — одразу партнерові, без розбору
    if (isGameRaw(msg)) {
      for (const o of this.seats(ws)) o.ws.send(msg);
      return;
    }
    let m: ClientMsg;
    try { m = JSON.parse(msg); } catch { return; }
    const room = await this.data();
    if (!room) return;
    const me = ws.deserializeAttachment() as Seat;
    switch (m.t) {
      case 'chat': {
        const text = cleanText(m.text, MAX_CHAT);
        if (text) this.broadcast({ t: 'chat', from: me.slot, name: me.name, text });
        return;
      }
      case 'level':
        if (!isLevelId(m.id) || room.phase !== 'lobby') return;
        room.level = m.id;
        break;
      case 'swap':
        if (room.phase !== 'lobby') return;
        room.swap = !room.swap;
        break;
      case 'start':
        if (this.seats().length < 2) return;
        if (isLevelId(m.level)) room.level = m.level;
        room.phase = 'game';
        room.epoch++;
        this.broadcast({ t: 'start', epoch: room.epoch, level: room.level });
        break;
      case 'lobby':
        if (room.phase === 'lobby') return;
        room.phase = 'lobby';
        this.broadcast({ t: 'lobby' });
        break;
      default:
        return;
    }
    await this.ctx.storage.put('room', room);
    await this.sendRoom();
  }

  async webSocketClose(ws: WebSocket) {
    try { ws.close(1000, 'bye'); } catch { /* уже закрито */ }
    const room = await this.data();
    const left = this.seats(ws);
    if (!left.length) { await this.ctx.storage.deleteAll(); return; }
    if (room && room.phase === 'game') {
      room.phase = 'lobby';
      await this.ctx.storage.put('room', room);
      for (const o of left) o.ws.send(JSON.stringify({ t: 'lobby', left: true } satisfies ServerMsg));
    }
    await this.sendRoom(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  private broadcast(m: ServerMsg) {
    const s = JSON.stringify(m);
    for (const o of this.seats()) o.ws.send(s);
  }

  // Кожен отримує стан кімнати зі своїм номером місця
  private async sendRoom(except?: WebSocket) {
    const room = await this.data();
    if (!room) return;
    const seats = this.seats(except);
    const players: PlayerInfo[] = seats
      .map(({ seat }) => ({ slot: seat.slot, name: seat.name, hero: ((seat.slot === 0) !== room.swap ? 0 : 1) as Hero }))
      .sort((a, b) => a.slot - b.slot);
    for (const { ws, seat } of seats) {
      ws.send(JSON.stringify({ t: 'room', code: room.code, you: seat.slot, players, level: room.level, phase: room.phase, epoch: room.epoch } satisfies ServerMsg));
    }
  }
}
