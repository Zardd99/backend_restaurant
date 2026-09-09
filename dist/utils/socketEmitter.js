"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSocketEvent = emitSocketEvent;
const redis_emitter_1 = require("@socket.io/redis-emitter");
const ioredis_1 = require("ioredis");
let emitter = null;
let initialised = false;
function getEmitter() {
    if (initialised)
        return emitter;
    initialised = true;
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url)
        return null;
    try {
        const redisClient = new ioredis_1.Redis(url, { lazyConnect: false });
        redisClient.on("error", (err) => console.error("Socket emitter Redis client error:", err.message));
        emitter = new redis_emitter_1.Emitter(redisClient);
    }
    catch (error) {
        console.error("Failed to initialise socket emitter; live events disabled:", error instanceof Error ? error.message : error);
        emitter = null;
    }
    return emitter;
}
function emitSocketEvent(event, payload) {
    const instance = getEmitter();
    if (!instance)
        return false;
    instance.emit(event, payload);
    return true;
}
//# sourceMappingURL=socketEmitter.js.map