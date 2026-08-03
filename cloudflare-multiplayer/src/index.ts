import { DurableObject } from "cloudflare:workers";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
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
  playerId: string | null;
  spectator: boolean;
  databaseHost: boolean;
  rateStartedAt: number;
  rateFrames: number;
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
const AUTHORITATIVE_EVENTS = new Set([
  "world_frame", "projectiles", "snapshot", "loadout_roster", "wave_complete",
  "start_game", "host_changed", "shared_money", "ready_roster"
]);
const RECOVERY_EVENTS = new Set(["snapshot", "world_frame", "loadout_roster"]);

interface AuthProtocol {
  playerId: string | null;
  token: string;
  spectator: boolean;
}

interface ValidatedAuth {
  valid: boolean;
  playerId: string | null;
  spectator: boolean;
  isHost: boolean;
}

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

function readAuthProtocol(request: Request): AuthProtocol | null {
  const protocols = String(request.headers.get("Sec-WebSocket-Protocol") || "")
    .split(",")
    .map(value => value.trim());
  if (!protocols.includes("last-wave-v1")) return null;
  if (protocols.includes("lw-spectator")) return { playerId: null, token: "", spectator: true };
  const encoded = protocols.find(value => value.startsWith("lw-auth."));
  const match = /^lw-auth\.([0-9a-f-]{36})\.([0-9a-f-]{32,160})$/i.exec(encoded || "");
  if (!match) return null;
  return { playerId: match[1], token: match[2], spectator: false };
}

async function validateAuth(
  env: Env,
  roomCode: string,
  auth: AuthProtocol
): Promise<ValidatedAuth> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error(JSON.stringify({ event: "auth_config_missing", roomCode }));
    return { valid: false, playerId: null, spectator: false, isHost: false };
  }
  try {
    const response = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/lw_validate_realtime_connection_v1`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: env.SUPABASE_ANON_KEY,
          authorization: `Bearer ${env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          p_room_code: roomCode,
          p_player_id: auth.playerId,
          p_session_token: auth.token,
          p_spectator: auth.spectator
        })
      }
    );
    if (!response.ok) {
      console.warn(JSON.stringify({ event: "auth_rpc_failed", roomCode, status: response.status }));
      return { valid: false, playerId: null, spectator: false, isHost: false };
    }
    const rows = await response.json() as Array<{ valid?: boolean; spectator?: boolean; is_host?: boolean }>;
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      valid: row?.valid === true,
      playerId: auth.playerId,
      spectator: row?.spectator === true,
      isHost: row?.is_host === true
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "auth_rpc_error", roomCode, message: String(error) }));
    return { valid: false, playerId: null, spectator: false, isHost: false };
  }
}

export class GameRoom extends DurableObject<Env> {
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

    const playerId = request.headers.get("X-Last-Wave-Player-Id");
    const spectator = request.headers.get("X-Last-Wave-Spectator") === "1";
    const databaseHost = request.headers.get("X-Last-Wave-Host") === "1";
    if ((!spectator && !playerId) || (spectator && playerId)) {
      return json({ error: "invalid_authorization_context" }, 403);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: ConnectionAttachment = {
      connectionId,
      presenceKey,
      joinedAt: Date.now(),
      presence: null,
      playerId,
      spectator,
      databaseHost,
      rateStartedAt: Date.now(),
      rateFrames: 0
    };

    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);

    server.send(JSON.stringify({
      op: "ready",
      connectionId,
      serverTime: Date.now()
    }));
    this.sendPresence(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "last-wave-v1" }
    });
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
    if (!attachment || !this.allowFrame(socket, attachment)) {
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

      if (
        presence.spectator !== attachment.spectator ||
        (!attachment.spectator && presence.playerId !== attachment.playerId)
      ) {
        socket.send(JSON.stringify({ op: "error", code: "presence_identity_mismatch" }));
        socket.close(4003, "presence_identity_mismatch");
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
      await this.sendRecoveryState(socket);
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
      if (messages.length) await this.relay(socket, messages);
      return;
    }

    if (message.op === "broadcast" && validGameMessage(message)) {
      await this.relay(socket, [{ event: message.event, payload: message.payload }]);
    }
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    const attachment = safeAttachment(socket);
    socket.close(code, reason);
    this.broadcastPresence(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.broadcastPresence(socket);
  }

  private allowFrame(socket: WebSocket, attachment: ConnectionAttachment): boolean {
    const now = Date.now();
    if (now - attachment.rateStartedAt >= 1000) {
      attachment.rateStartedAt = now;
      attachment.rateFrames = 1;
      socket.serializeAttachment(attachment);
      return true;
    }
    attachment.rateFrames += 1;
    socket.serializeAttachment(attachment);
    return attachment.rateFrames <= 180;
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

  private authoritativeSocket(): WebSocket | null {
    const candidates = this.ctx.getWebSockets()
      .map(socket => ({ socket, attachment: safeAttachment(socket) }))
      .filter(item => item.attachment?.presence && !item.attachment.spectator)
      .sort((a, b) => {
        const hostDifference = Number(Boolean(b.attachment?.databaseHost)) - Number(Boolean(a.attachment?.databaseHost));
        return hostDifference || Number(a.attachment?.joinedAt || 0) - Number(b.attachment?.joinedAt || 0);
      });
    return candidates[0]?.socket || null;
  }

  private async sendRecoveryState(socket: WebSocket): Promise<void> {
    const state = await this.ctx.storage.get<Record<string, GameMessage>>("recovery_state");
    const messages = state ? Object.values(state) : [];
    if (!messages.length) return;
    try {
      socket.send(JSON.stringify({ op: "batch", messages, recovery: true, serverTime: Date.now() }));
    } catch {
      // The socket may close while storage is being read.
    }
  }

  private async relay(sender: WebSocket, messages: GameMessage[]): Promise<void> {
    const senderAttachment = safeAttachment(sender);
    if (!senderAttachment?.presence || senderAttachment.spectator) return;
    const authority = this.authoritativeSocket();
    const accepted = messages.filter(message => !AUTHORITATIVE_EVENTS.has(message.event) || sender === authority);
    if (!accepted.length) {
      sender.send(JSON.stringify({ op: "error", code: "authority_required" }));
      return;
    }

    const recoveryMessages = accepted.filter(message => RECOVERY_EVENTS.has(message.event));
    if (recoveryMessages.length) {
      const current = await this.ctx.storage.get<Record<string, GameMessage>>("recovery_state") || {};
      for (const message of recoveryMessages) current[message.event] = message;
      await this.ctx.storage.put("recovery_state", current);
    }

    const payload = JSON.stringify({
      op: "batch",
      messages: accepted,
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
        transport: "cloudflare-durable-objects",
        auth: "supabase-room-capability-v1",
        recovery: "durable-object-sqlite"
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
    const protocol = readAuthProtocol(request);
    if (!protocol) return json({ error: "authorization_required" }, 401);
    const auth = await validateAuth(env, roomCode, protocol);
    if (!auth.valid) return json({ error: "authorization_failed" }, 403);

    const forwarded = new Request(request);
    forwarded.headers.set("X-Last-Wave-Player-Id", auth.playerId || "");
    forwarded.headers.set("X-Last-Wave-Spectator", auth.spectator ? "1" : "0");
    forwarded.headers.set("X-Last-Wave-Host", auth.isHost ? "1" : "0");
    console.log(JSON.stringify({ event: "room_connect", roomCode, playerId: auth.playerId, spectator: auth.spectator }));
    return env.GAME_ROOMS.getByName(roomCode).fetch(forwarded);
  }
} satisfies ExportedHandler<Env>;
