import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";

interface CachedResponse {
  status: number;
  body: unknown;
}

interface IdempotencyOptions {
  /** Replay window in seconds (how long a key is remembered). Default 24h. */
  ttlSeconds?: number;
  /** Reject requests that omit the Idempotency-Key header. Default false. */
  required?: boolean;
}

/**
 * Double-submit / retry protection backed by Upstash Redis.
 *
 * - The first request claims `Idempotency-Key` via SET NX PX and proceeds.
 * - A concurrent duplicate (claim still held, no cached result) gets 409.
 * - A finished duplicate replays the cached successful response.
 * - Non-2xx responses release the claim so a genuine retry can proceed.
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 24;
  const required = options.required ?? false;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const key = req.header("Idempotency-Key");
    if (!key) {
      if (required) {
        res.status(400).json({ error: "Idempotency-Key header is required" });
        return;
      }
      next();
      return;
    }

    const claimKey = `idem:${req.method}:${req.baseUrl}${req.path}:${key}`;
    const responseKey = `${claimKey}:res`;

    const cached = await redis.get<CachedResponse>(responseKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const claimed = await redis.set(claimKey, "processing", {
      nx: true,
      ex: ttlSeconds,
    });
    if (claimed !== "OK") {
      res.status(409).json({
        error: "Duplicate request already in progress",
        idempotencyKey: key,
      });
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void redis.set(
          responseKey,
          { status: res.statusCode, body } satisfies CachedResponse,
          { ex: ttlSeconds },
        );
      } else {
        void redis.del(claimKey);
      }
      return originalJson(body);
    };

    next();
  };
}

export default idempotency;
