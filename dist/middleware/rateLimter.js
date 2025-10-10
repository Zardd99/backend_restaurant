"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requestStore = new Map();
const defaultConfig = {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10000,
    message: "too many request",
    skipFailedRequests: false,
};
const rateLimiter = (config = {}) => {
    const { windowMs, maxRequests, message, skipFailedRequests } = Object.assign(Object.assign({}, defaultConfig), config);
    return async (req, res, next) => {
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
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - clientData.count));
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
            res.send = function (body) {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    clientData.count -= 1;
                }
                return originalSend.call(this, body);
            };
        }
        next();
    };
};
function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of requestStore.entries()) {
        if (now > value.resetTime) {
            requestStore.delete(key);
        }
    }
}
setInterval(cleanupExpiredEntries, 60 * 1000);
exports.default = rateLimiter;
//# sourceMappingURL=rateLimter.js.map