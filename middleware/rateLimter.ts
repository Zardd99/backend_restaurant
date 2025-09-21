import { Request, Response, NextFunction } from "express";

const requestStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipFailedRequests?: boolean;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 10000,
  message: "too many request",
  skipFailedRequests: false,
};

const rateLimiter = (config: Partial<RateLimitConfig> = {}) => {
  const { windowMs, maxRequests, message, skipFailedRequests } = {
    ...defaultConfig,
    ...config,
  };

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const clientId = req.ip || req.socket.remoteAddress || "unknow";

    const now = Date.now();

    let clientData = requestStore.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestStore.set(clientId, clientData);
    }

    clientData.count += 1;

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - clientData.count)
    );
    res.setHeader("X-RateLimit-Reset", Math.ceil(clientData.resetTime / 1000));

    if (clientData.count > maxRequests) {
      cleanupExpiredEntries();

      res.status(429).json({
        error: "Rate Limit exceeded",
        message,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
      return;
    }

    if (skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (body?: string | Buffer | object): Response {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          clientData!.count -= 1;
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
};

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (now > value.resetTime) {
      requestStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60 * 1000);

export default rateLimiter;
