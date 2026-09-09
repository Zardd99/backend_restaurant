"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.apiLimiter = void 0;
exports.rateLimit = rateLimit;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("../config/redis");
function rateLimit(options) {
    const limiter = new ratelimit_1.Ratelimit({
        redis: redis_1.redis,
        limiter: ratelimit_1.Ratelimit.slidingWindow(options.tokens, options.window),
        prefix: `rl:${options.prefix}`,
        ephemeralCache: new Map(),
        analytics: false,
    });
    return async (req, res, next) => {
        var _a, _b;
        const identifier = (_b = (_a = req.ip) !== null && _a !== void 0 ? _a : req.socket.remoteAddress) !== null && _b !== void 0 ? _b : "unknown";
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
exports.apiLimiter = rateLimit({ tokens: 600, window: "1 m", prefix: "api" });
exports.authLimiter = rateLimit({ tokens: 10, window: "15 m", prefix: "auth" });
//# sourceMappingURL=rateLimit.js.map