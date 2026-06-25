import { IUser } from "../models/User";

const TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 60_000);
const MAX_ENTRIES = Number(process.env.AUTH_CACHE_MAX_ENTRIES ?? 10_000);

interface CacheEntry {
  user: IUser;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry>();

const touchAsMostRecent = (userId: string, entry: CacheEntry): void => {
  entries.delete(userId);
  entries.set(userId, entry);
};

export const getCachedUser = (userId: string): IUser | undefined => {
  const entry = entries.get(userId);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    entries.delete(userId);
    return undefined;
  }

  touchAsMostRecent(userId, entry);
  return entry.user;
};

export const setCachedUser = (userId: string, user: IUser): void => {
  touchAsMostRecent(userId, { user, expiresAt: Date.now() + TTL_MS });

  if (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey !== undefined) entries.delete(oldestKey);
  }
};

export const invalidateCachedUser = (userId: string): void => {
  entries.delete(userId);
};

export const clearUserCache = (): void => {
  entries.clear();
};
