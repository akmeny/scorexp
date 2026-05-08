import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import type { PushNotificationService } from "../services/pushNotifications.js";
import type { AuthUserSnapshot, UserProfileStore } from "../storage/userProfileStore.js";
import { isSupabaseAuthConfigured, resolveAuthUser } from "./auth.js";

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
    const user = await requireAuthUser(request, reply, env);
    if (!user) return reply;

    await profileStore.ensureProfile(user);
    const subscription = pushSubscriptionSchema.parse(request.body);
    const record = await pushService.subscribe(user.id, subscription, request.headers["user-agent"] ?? null);
    reply.header("Cache-Control", "no-store");

    return {
      ok: true,
      subscriptionId: record.id
    };
  });

  app.delete("/api/v1/notifications/subscription", async (request, reply) => {
    const user = await requireAuthUser(request, reply, env);
    if (!user) return reply;

    const { endpoint } = unsubscribeSchema.parse(request.body);
    await pushService.unsubscribe(user.id, endpoint);
    reply.header("Cache-Control", "no-store");

    return { ok: true };
  });

  app.put("/api/v1/notifications/favorites", async (request, reply) => {
    const user = await requireAuthUser(request, reply, env);
    if (!user) return reply;

    await profileStore.ensureProfile(user);
    const { favoriteIds } = favoriteSyncSchema.parse(request.body);
    await pushService.syncFavorites(user.id, favoriteIds);
    reply.header("Cache-Control", "no-store");

    return {
      ok: true,
      favoriteCount: favoriteIds.length
    };
  });
}

async function requireAuthUser(request: FastifyRequest, reply: FastifyReply, env: AppEnv): Promise<AuthUserSnapshot | null> {
  if (!isSupabaseAuthConfigured(env)) {
    reply.code(503).send({ message: "Auth is not configured" });
    return null;
  }

  const user = await resolveAuthUser(request, env);
  if (!user) {
    reply.code(401).send({ message: "Missing bearer token" });
    return null;
  }

  return user;
}
