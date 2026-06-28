import { Ratelimit } from "@upstash/ratelimit";
import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";

type Unit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number} ${Unit}`;

interface RateLimitOptions {
  tokens: number;
  window: Duration;
  prefix: string;
}

/**
 * Distributed sliding-window rate limiter backed by Upstash Redis.
 *
 * Shared across replicas (state lives in Redis, not process memory). The
 * ephemeral in-memory cache lets already-blocked clients short-circuit without
 * a Redis round-trip. Requires `app.set("trust proxy", 1)` so `req.ip` is the
 * real client IP behind Railway's proxy.
 */
export function rateLimit(options: RateLimitOptions) {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.tokens, options.window),
    prefix: `rl:${options.prefix}`,
    ephemeralCache: new Map<string, number>(),
    analytics: false,
  });

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const identifier = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(reset / 1000));

    if (!success) {
      res.status(429).json({
        error: "Rate limit exceeded",
        retryAfter: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
      });
      return;
    }

    next();
  };
}

/** Generous global limit for the busy staff order path. */
export const apiLimiter = rateLimit({ tokens: 600, window: "1 m", prefix: "api" });

/** Strict limit for credential endpoints (login/register). */
export const authLimiter = rateLimit({ tokens: 10, window: "15 m", prefix: "auth" });
