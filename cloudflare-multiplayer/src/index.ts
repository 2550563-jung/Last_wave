import { DurableObject } from "cloudflare:workers";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ALLOWED_ORIGINS?: string;
}

interface Presence {
  playerId?: string;
  sessionId?: string;
  spectator?: boolean;
  [key: string]: unknown;
}

interface ConnectionAttachment {
  connectionId: string;
  presenceKey: string;
  joinedAt: number;
  presence: Presence | null;
}

interface GameMessage {
  event: string;
  payload: unknown;
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const EVENT_NAME_PATTERN = /^[a-z0-9_:-]{1,64}$/i;
const MAX_ACTIVE_PLAYERS = 4;
const MAX_CONNECTIONS = 24;
const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_BATCH_MESSAGES = 32;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isAllowedOrigin(request: Request, allowedOrigins?: string): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return true;
  }

  const allowed = String(allowedOrigins || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return allowed.includes("*") || allowed.includes(parsed.origin);
}

function validGameMessage(value: unknown): value is GameMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as GameMessage;
  return (
    typeof candidate.event === "string" &&
    EVENT_NAME_PATTERN.test(candidate.event) &&
    Object.prototype.hasOwnProperty.call(candidate, "payload")
  );
}

function safeAttachment(socket: WebSocket): ConnectionAttachment | null {
  try {
    return socket.deserializeAttachment() as ConnectionAttachment | null;
  } catch {
    return null;
  }
}

export class GameRoom extends DurableObject<Env> {
  private rateWindows = new Map<string, { startedAt: number; frames: number }>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket_required" }, 426);
    }

    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_CONNECTIONS) {
      return json({ error: "room_connection_limit" }, 429);
    }

    const url = new URL(request.url);
    const connectionId = String(url.searchParams.get("connection_id") || "").slice(0, 96);
    const presenceKey = String(url.searchParams.get("presence_key") || connectionId).slice(0, 96);
    if (!connectionId || !presenceKey) {
      return json({ error: "invalid_connection" }, 400);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: ConnectionAttachment = {
      connectionId,
      presenceKey,
      joinedAt: Date.now(),
      presence: null
    };

    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);

    server.send(JSON.stringify({
      op: "ready",
      connectionId,
      serverTime: Date.now()
    }));
    this.sendPresence(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") {
      socket.close(1003, "text_messages_only");
      return;
    }

    if (new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) {
      socket.close(1009, "message_too_large");
      return;
    }

    const attachment = safeAttachment(socket);
    if (!attachment || !this.allowFrame(attachment.connectionId)) {
      socket.close(1008, "rate_limit");
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      socket.send(JSON.stringify({ op: "error", code: "invalid_json" }));
      return;
    }

    if (!data || typeof data !== "object") return;
    const message = data as Record<string, unknown>;

    if (message.op === "track") {
      const presence = this.cleanPresence(message.presence);
      if (!presence) {
        socket.send(JSON.stringify({ op: "error", code: "invalid_presence" }));
        return;
      }

      if (!presence.spectator && !this.canJoinAsPlayer(presence.playerId, socket)) {
        socket.send(JSON.stringify({ op: "error", code: "room_full" }));
        socket.close(4004, "room_full");
        return;
      }

      attachment.presence = presence;
      socket.serializeAttachment(attachment);
      this.broadcastPresence();
      return;
    }

    if (message.op === "presence_request") {
      this.sendPresence(socket);
      return;
    }

    if (message.op === "ping") {
      socket.send(JSON.stringify({ op: "pong", at: Date.now() }));
      return;
    }

    if (message.op === "batch") {
      const messages = Array.isArray(message.messages)
        ? message.messages.slice(0, MAX_BATCH_MESSAGES).filter(validGameMessage)
        : [];
      if (messages.length) this.relay(socket, messages);
      return;
    }

    if (message.op === "broadcast" && validGameMessage(message)) {
      this.relay(socket, [{ event: message.event, payload: message.payload }]);
    }
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    const attachment = safeAttachment(socket);
    if (attachment) this.rateWindows.delete(attachment.connectionId);
    socket.close(code, reason);
    this.broadcastPresence(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = safeAttachment(socket);
    if (attachment) this.rateWindows.delete(attachment.connectionId);
    this.broadcastPresence(socket);
  }

  private allowFrame(connectionId: string): boolean {
    const now = Date.now();
    const current = this.rateWindows.get(connectionId);
    if (!current || now - current.startedAt >= 1000) {
      this.rateWindows.set(connectionId, { startedAt: now, frames: 1 });
      return true;
    }
    current.frames += 1;
    return current.frames <= 180;
  }

  private cleanPresence(raw: unknown): Presence | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const source = raw as Record<string, unknown>;
    const encoded = JSON.stringify(source);
    if (encoded.length > 12_000) return null;

    const presence = JSON.parse(encoded) as Presence;
    presence.spectator = presence.spectator === true;
    if (!presence.spectator) {
      presence.playerId = String(presence.playerId || "").slice(0, 96);
      presence.sessionId = String(presence.sessionId || "").slice(0, 96);
      if (!presence.playerId || !presence.sessionId) return null;
    }
    return presence;
  }

  private canJoinAsPlayer(playerId: string | undefined, joiningSocket: WebSocket): boolean {
    if (!playerId) return false;
    const activePlayerIds = new Set<string>();

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === joiningSocket) continue;
      const presence = safeAttachment(socket)?.presence;
      if (presence?.playerId && !presence.spectator) {
        activePlayerIds.add(presence.playerId);
      }
    }

    return activePlayerIds.has(playerId) || activePlayerIds.size < MAX_ACTIVE_PLAYERS;
  }

  private presenceState(excludedSocket?: WebSocket): Record<string, Presence[]> {
    const state: Record<string, Presence[]> = {};
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === excludedSocket) continue;
      const attachment = safeAttachment(socket);
      if (!attachment?.presence) continue;
      state[attachment.presenceKey] = [attachment.presence];
    }
    return state;
  }

  private sendPresence(socket: WebSocket): void {
    try {
      socket.send(JSON.stringify({
        op: "presence",
        state: this.presenceState(),
        serverTime: Date.now()
      }));
    } catch {
      // A closing socket can disappear between getWebSockets() and send().
    }
  }

  private broadcastPresence(excludedSocket?: WebSocket): void {
    const payload = JSON.stringify({
      op: "presence",
      state: this.presenceState(excludedSocket),
      serverTime: Date.now()
    });
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === excludedSocket) continue;
      try {
        socket.send(payload);
      } catch {
        // Ignore sockets that closed during the broadcast.
      }
    }
  }

  private relay(sender: WebSocket, messages: GameMessage[]): void {
    const payload = JSON.stringify({
      op: "batch",
      messages,
      serverTime: Date.now()
    });
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === sender) continue;
      try {
        socket.send(payload);
      } catch {
        // Ignore sockets that closed during the broadcast.
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "last-wave-multiplayer",
        transport: "cloudflare-durable-objects"
      });
    }

    const match = /^\/rooms\/([A-Za-z0-9]{6})\/connect$/.exec(url.pathname);
    if (!match) return json({ error: "not_found" }, 404);
    if (!isAllowedOrigin(request, env.ALLOWED_ORIGINS)) {
      return json({ error: "origin_not_allowed" }, 403);
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket_required" }, 426);
    }

    const roomCode = match[1].toUpperCase();
    if (!ROOM_CODE_PATTERN.test(roomCode)) {
      return json({ error: "invalid_room_code" }, 400);
    }

    return env.GAME_ROOMS.getByName(roomCode).fetch(request);
  }
} satisfies ExportedHandler<Env>;
