import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const maxRoomMessages = 150;
const maxBodyLength = 360;

interface ChatMessage {
  id: string;
  matchId: string;
  authorId: string;
  nickname: string;
  color: string;
  body: string;
  createdAt: string;
}

interface SseClient {
  id: string;
  write: (event: string, data: unknown) => void;
  close: () => void;
}

interface ChatRoom {
  messages: ChatMessage[];
  clients: Map<string, SseClient>;
}

const rooms = new Map<string, ChatRoom>();

const paramsSchema = z.object({
  matchId: z.string().min(1).max(180)
});

const postMessageSchema = z.object({
  authorId: z.string().min(4).max(96),
  nickname: z.string().min(2).max(28),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  body: z.string().min(1).max(maxBodyLength)
});

export async function registerChatRoutes(app: FastifyInstance) {
  app.get("/api/v1/chat/rooms/:matchId/messages", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const room = getRoom(params.matchId);

    reply.header("Cache-Control", "no-store");

    return {
      roomId: params.matchId,
      generatedAt: new Date().toISOString(),
      messages: room.messages
    };
  });

  app.post("/api/v1/chat/rooms/:matchId/messages", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const parsed = postMessageSchema.parse(request.body);
    const room = getRoom(params.matchId);
    const message: ChatMessage = {
      id: randomUUID(),
      matchId: params.matchId,
      authorId: cleanToken(parsed.authorId),
      nickname: cleanNickname(parsed.nickname),
      color: parsed.color,
      body: cleanBody(parsed.body),
      createdAt: new Date().toISOString()
    };

    if (!message.body) {
      return reply.code(400).send({ message: "Message body is empty" });
    }

    room.messages.push(message);
    if (room.messages.length > maxRoomMessages) {
      room.messages.splice(0, room.messages.length - maxRoomMessages);
    }

    broadcast(room, "message", message);
    reply.header("Cache-Control", "no-store");

    return { message };
  });

  app.get("/api/v1/chat/rooms/:matchId/events", (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const room = getRoom(params.matchId);
    const clientId = randomUUID();
    let heartbeat: NodeJS.Timeout | null = null;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Access-Control-Allow-Origin": request.headers.origin ?? "*",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      Vary: "Origin",
      "X-Accel-Buffering": "no"
    });

    const client: SseClient = {
      id: clientId,
      write: (event, data) => {
        if (reply.raw.writableEnded || reply.raw.destroyed) return;
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      },
      close: () => {
        if (heartbeat) windowSafeClearInterval(heartbeat);
        room.clients.delete(clientId);
      }
    };

    room.clients.set(clientId, client);
    client.write("ready", {
      roomId: params.matchId,
      connectedAt: new Date().toISOString(),
      messages: room.messages
    });

    heartbeat = setInterval(() => {
      client.write("ping", { now: new Date().toISOString() });
    }, 25_000);

    request.raw.on("close", client.close);
  });
}

function getRoom(matchId: string) {
  const key = normalizeRoomKey(matchId);
  const existing = rooms.get(key);
  if (existing) return existing;

  const room: ChatRoom = {
    messages: [],
    clients: new Map()
  };
  rooms.set(key, room);
  return room;
}

function broadcast(room: ChatRoom, event: string, data: unknown) {
  for (const client of room.clients.values()) {
    client.write(event, data);
  }
}

function normalizeRoomKey(matchId: string) {
  return matchId.trim().toLowerCase();
}

function cleanToken(value: string) {
  return value.trim().replace(/[^\w:-]/g, "").slice(0, 96);
}

function cleanNickname(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 28);
}

function cleanBody(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxBodyLength);
}

function windowSafeClearInterval(timer: NodeJS.Timeout) {
  clearInterval(timer);
}
