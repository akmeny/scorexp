import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import type { AuthUserSnapshot, UserProfileStore } from "../storage/userProfileStore.js";

const profilePatchSchema = z.object({
  nickname: z.string().min(2).max(28).optional(),
  notificationsEnabled: z.boolean().optional(),
  notificationPermission: z.enum(["default", "granted", "denied"]).nullable().optional()
});

interface SupabaseUserResponse {
  id?: unknown;
  email?: unknown;
  app_metadata?: unknown;
  user_metadata?: unknown;
}

export async function registerAuthRoutes(app: FastifyInstance, env: AppEnv, profileStore: UserProfileStore) {
  app.get("/api/v1/auth/status", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    return {
      configured: isSupabaseAuthConfigured(env),
      providers: ["google", "apple", "facebook", "twitter"]
    };
  });

  app.get("/api/v1/me", async (request, reply) => {
    const user = await requireAuthUser(request, reply, env);
    if (!user) return reply;

    const profile = await profileStore.ensureProfile(user);
    reply.header("Cache-Control", "no-store");

    return { profile };
  });

  app.patch("/api/v1/me", async (request, reply) => {
    const user = await requireAuthUser(request, reply, env);
    if (!user) return reply;

    const patch = profilePatchSchema.parse(request.body);
    const profile = await profileStore.updateProfile(user, patch);
    reply.header("Cache-Control", "no-store");

    return { profile };
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

export function isSupabaseAuthConfigured(env: AppEnv) {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export async function resolveAuthUser(request: FastifyRequest, env: AppEnv): Promise<AuthUserSnapshot | null> {
  if (!isSupabaseAuthConfigured(env)) return null;

  const token = bearerToken(request.headers.authorization);
  if (!token) return null;

  return fetchSupabaseUser(env, token);
}

function bearerToken(value: string | undefined) {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function fetchSupabaseUser(env: AppEnv, token: string): Promise<AuthUserSnapshot | null> {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey ?? "",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as SupabaseUserResponse;
  if (typeof payload.id !== "string") return null;

  const appMetadata = objectRecord(payload.app_metadata);
  const userMetadata = objectRecord(payload.user_metadata);
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers.filter((item): item is string => typeof item === "string") : [];
  const provider = typeof appMetadata.provider === "string" ? appMetadata.provider : providers[0] ?? null;

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : null,
    provider,
    nicknameHint: firstString(userMetadata.nickname, userMetadata.name, userMetadata.full_name, userMetadata.user_name)
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}
