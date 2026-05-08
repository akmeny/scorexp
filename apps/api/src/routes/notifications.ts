import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import type { PushNotificationService } from "../services/pushNotifications.js";
import type { AuthUserSnapshot, UserProfileStore } from "../storage/userProfileStore.js";
import { resolveAuthUser } from "./auth.js";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url()
});

const favoriteSyncSchema = z.object({
  favoriteIds: z.array(z.string().min(1)).max(500)
});

export async function registerNotificationRoutes(
  app: FastifyInstance,
  env: AppEnv,
  profileStore: UserProfileStore,
  pushService: PushNotificationService
) {
  app.get("/api/v1/notifications/vapid-public-key", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return pushService.getPublicConfig();
  });

  app.put("/api/v1/notifications/subscription", async (request, reply) => {
    const identity = await resolveNotificationIdentity(request, reply, env, profileStore);
    if (!identity) return reply;

    const subscription = pushSubscriptionSchema.parse(request.body);
    const record = await pushService.subscribe(identity.id, subscription, headerString(request.headers["user-agent"]));
    reply.header("Cache-Control", "no-store");

    return {
      ok: true,
      subscriptionId: record.id
    };
  });

  app.delete("/api/v1/notifications/subscription", async (request, reply) => {
    const identity = await resolveNotificationIdentity(request, reply, env, profileStore);
    if (!identity) return reply;

    const { endpoint } = unsubscribeSchema.parse(request.body);
    await pushService.unsubscribe(identity.id, endpoint);
    reply.header("Cache-Control", "no-store");

    return { ok: true };
  });

  app.put("/api/v1/notifications/favorites", async (request, reply) => {
    const identity = await resolveNotificationIdentity(request, reply, env, profileStore);
    if (!identity) return reply;

    const { favoriteIds } = favoriteSyncSchema.parse(request.body);
    await pushService.syncFavorites(identity.id, favoriteIds);
    reply.header("Cache-Control", "no-store");

    return {
      ok: true,
      favoriteCount: favoriteIds.length
    };
  });
}

async function resolveNotificationIdentity(
  request: FastifyRequest,
  reply: FastifyReply,
  env: AppEnv,
  profileStore: UserProfileStore
): Promise<{ id: string; user: AuthUserSnapshot | null } | null> {
  if (request.headers.authorization) {
    const user = await resolveAuthUser(request, env);
    if (!user) {
      reply.code(401).send({ message: "Invalid bearer token" });
      return null;
    }

    await profileStore.ensureProfile(user);
    return { id: user.id, user };
  }

  const deviceId = normalizeDeviceId(headerString(request.headers["x-scorexp-device-id"]));
  if (!deviceId) {
    reply.code(401).send({ message: "Missing notification identity" });
    return null;
  }

  return { id: `device:${deviceId}`, user: null };
}

function headerString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

function normalizeDeviceId(value: string | null) {
  const normalized = value?.trim() ?? "";
  return /^[a-zA-Z0-9_-]{16,96}$/.test(normalized) ? normalized : null;
}
