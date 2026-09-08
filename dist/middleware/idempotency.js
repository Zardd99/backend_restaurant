"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotency = idempotency;
const redis_1 = require("../config/redis");
function idempotency(options = {}) {
    var _a, _b;
    const ttlSeconds = (_a = options.ttlSeconds) !== null && _a !== void 0 ? _a : 60 * 60 * 24;
    const required = (_b = options.required) !== null && _b !== void 0 ? _b : false;
    return async (req, res, next) => {
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
        const cached = await redis_1.redis.get(responseKey);
        if (cached) {
            res.status(cached.status).json(cached.body);
            return;
        }
        const claimed = await redis_1.redis.set(claimKey, "processing", {
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
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                void redis_1.redis.set(responseKey, { status: res.statusCode, body }, { ex: ttlSeconds });
            }
            else {
                void redis_1.redis.del(claimKey);
            }
            return originalJson(body);
        };
        next();
    };
}
exports.default = idempotency;
//# sourceMappingURL=idempotency.js.map