"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRedisLock = withRedisLock;
const crypto_1 = require("crypto");
const redis_1 = require("../config/redis");
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;
async function withRedisLock(key, ttlMs, fn) {
    const lockKey = `lock:${key}`;
    const token = (0, crypto_1.randomUUID)();
    const acquired = await redis_1.redis.set(lockKey, token, { nx: true, px: ttlMs });
    if (acquired !== "OK") {
        return false;
    }
    try {
        await fn();
    }
    finally {
        try {
            await redis_1.redis.eval(RELEASE_SCRIPT, [lockKey], [token]);
        }
        catch (_a) {
        }
    }
    return true;
}
exports.default = withRedisLock;
//# sourceMappingURL=redisLock.js.map