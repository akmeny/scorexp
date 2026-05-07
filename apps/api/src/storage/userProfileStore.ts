import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "ioredis";
import type { AppEnv } from "../config/env.js";

export interface UserProfile {
  userId: string;
  email: string | null;
  provider: string | null;
  nickname: string;
  notificationsEnabled: boolean;
  notificationPermission: "default" | "granted" | "denied" | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserSnapshot {
  id: string;
  email: string | null;
  provider: string | null;
  nicknameHint: string | null;
}

export interface UserProfilePatch {
  nickname?: string;
  notificationsEnabled?: boolean;
  notificationPermission?: "default" | "granted" | "denied" | null;
}

export interface UserProfileStore {
  getProfile(userId: string): Promise<UserProfile | null>;
  ensureProfile(user: AuthUserSnapshot): Promise<UserProfile>;
  updateProfile(user: AuthUserSnapshot, patch: UserProfilePatch): Promise<UserProfile>;
  close(): Promise<void>;
}

type UserProfileRecord = Record<string, UserProfile>;

const profileFileName = "user-profiles.json";

export async function createUserProfileStore(env: AppEnv): Promise<UserProfileStore> {
  if (env.redisUrl) {
    try {
      const redis = new Redis(env.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false
      });
      await redis.connect();
      return new RedisUserProfileStore(redis);
    } catch (error) {
      console.warn(`User profile Redis store unavailable, falling back to file store: ${(error as Error).message}`);
    }
  }

  return new FileUserProfileStore(path.join(env.dataDir, profileFileName));
}

class RedisUserProfileStore implements UserProfileStore {
  private readonly prefix = "scorexp:userProfiles";

  constructor(private readonly redis: InstanceType<typeof Redis>) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    const raw = await this.redis.get(this.profileKey(userId));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  }

  async ensureProfile(user: AuthUserSnapshot): Promise<UserProfile> {
    const existing = await this.getProfile(user.id);
    if (existing) {
      const refreshed = refreshAuthFields(existing, user);
      if (refreshed !== existing) {
        await this.save(refreshed);
      }
      return refreshed;
    }

    const created = createDefaultProfile(user);
    await this.save(created);
    return created;
  }

  async updateProfile(user: AuthUserSnapshot, patch: UserProfilePatch): Promise<UserProfile> {
    const current = await this.ensureProfile(user);
    const updated = applyPatch(current, patch);
    await this.save(updated);
    return updated;
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }

  private async save(profile: UserProfile) {
    await this.redis.set(this.profileKey(profile.userId), JSON.stringify(profile));
  }

  private profileKey(userId: string) {
    return `${this.prefix}:${userId}`;
  }
}

class FileUserProfileStore implements UserProfileStore {
  constructor(private readonly filePath: string) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    const records = await this.readRecords();
    return records[userId] ?? null;
  }

  async ensureProfile(user: AuthUserSnapshot): Promise<UserProfile> {
    const records = await this.readRecords();
    const existing = records[user.id];
    if (existing) {
      const refreshed = refreshAuthFields(existing, user);
      if (refreshed !== existing) {
        records[user.id] = refreshed;
        await this.writeRecords(records);
      }
      return refreshed;
    }

    const created = createDefaultProfile(user);
    records[user.id] = created;
    await this.writeRecords(records);
    return created;
  }

  async updateProfile(user: AuthUserSnapshot, patch: UserProfilePatch): Promise<UserProfile> {
    const records = await this.readRecords();
    const current = records[user.id] ?? createDefaultProfile(user);
    const updated = applyPatch(refreshAuthFields(current, user), patch);
    records[user.id] = updated;
    await this.writeRecords(records);
    return updated;
  }

  async close(): Promise<void> {
    return undefined;
  }

  private async readRecords(): Promise<UserProfileRecord> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed as UserProfileRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeRecords(records: UserProfileRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

function createDefaultProfile(user: AuthUserSnapshot): UserProfile {
  const now = new Date().toISOString();

  return {
    userId: user.id,
    email: user.email,
    provider: user.provider,
    nickname: defaultNickname(user),
    notificationsEnabled: false,
    notificationPermission: null,
    createdAt: now,
    updatedAt: now
  };
}

function refreshAuthFields(profile: UserProfile, user: AuthUserSnapshot): UserProfile {
  if (profile.email === user.email && profile.provider === user.provider) return profile;

  return {
    ...profile,
    email: user.email,
    provider: user.provider,
    updatedAt: new Date().toISOString()
  };
}

function applyPatch(profile: UserProfile, patch: UserProfilePatch): UserProfile {
  return {
    ...profile,
    nickname: patch.nickname !== undefined ? cleanNickname(patch.nickname) : profile.nickname,
    notificationsEnabled: patch.notificationsEnabled ?? profile.notificationsEnabled,
    notificationPermission: patch.notificationPermission !== undefined ? patch.notificationPermission : profile.notificationPermission,
    updatedAt: new Date().toISOString()
  };
}

function defaultNickname(user: AuthUserSnapshot) {
  return cleanNickname(user.nicknameHint ?? user.email?.split("@")[0] ?? "ScoreXPli");
}

export function cleanNickname(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 28);
  if (cleaned.length >= 2) return cleaned;
  return `Taraftar${Math.floor(100 + Math.random() * 900)}`;
}
