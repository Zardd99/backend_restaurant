"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearUserCache = exports.invalidateCachedUser = exports.setCachedUser = exports.getCachedUser = void 0;
const TTL_MS = Number((_a = process.env.AUTH_CACHE_TTL_MS) !== null && _a !== void 0 ? _a : 60000);
const MAX_ENTRIES = Number((_b = process.env.AUTH_CACHE_MAX_ENTRIES) !== null && _b !== void 0 ? _b : 10000);
const entries = new Map();
const touchAsMostRecent = (userId, entry) => {
    entries.delete(userId);
    entries.set(userId, entry);
};
const getCachedUser = (userId) => {
    const entry = entries.get(userId);
    if (!entry)
        return undefined;
    if (entry.expiresAt <= Date.now()) {
        entries.delete(userId);
        return undefined;
    }
    touchAsMostRecent(userId, entry);
    return entry.user;
};
exports.getCachedUser = getCachedUser;
const setCachedUser = (userId, user) => {
    touchAsMostRecent(userId, { user, expiresAt: Date.now() + TTL_MS });
    if (entries.size > MAX_ENTRIES) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey !== undefined)
            entries.delete(oldestKey);
    }
};
exports.setCachedUser = setCachedUser;
const invalidateCachedUser = (userId) => {
    entries.delete(userId);
};
exports.invalidateCachedUser = invalidateCachedUser;
const clearUserCache = () => {
    entries.clear();
};
exports.clearUserCache = clearUserCache;
//# sourceMappingURL=userCache.js.map