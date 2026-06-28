import { randomUUID } from "crypto";
import { redis } from "../config/redis";

/**
 * Atomic compare-and-delete: only releases the lock if the stored value still
 * matches this caller's token, preventing a slow holder from deleting a lock
 * another instance has since acquired.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Run `fn` while holding a distributed mutex.
 *
 * Returns true if this caller acquired the lock and executed `fn`; false if the
 * lock was already held (so the work was skipped on this instance). The lock is
 * always released via a token-matched Lua script in `finally`.
 */
export async function withRedisLock(
  key: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  const lockKey = `lock:${key}`;
  const token = randomUUID();

  const acquired = await redis.set(lockKey, token, { nx: true, px: ttlMs });
  if (acquired !== "OK") {
    return false;
  }

  try {
    await fn();
  } finally {
    try {
      await redis.eval(RELEASE_SCRIPT, [lockKey], [token]);
    } catch {
      // Best-effort release; the px TTL guarantees the lock expires regardless.
    }
  }

  return true;
}

export default withRedisLock;
