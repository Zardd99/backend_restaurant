import { Emitter } from "@socket.io/redis-emitter";
import { Redis } from "ioredis";

/**
 * Worker-side Socket.io emitter.
 *
 * The standalone worker has no Socket.io server of its own. When the rediss://
 * TCP endpoint (UPSTASH_REDIS_URL) is configured, this publishes events through
 * the same Redis channel the web process's @socket.io/redis-adapter listens on,
 * so events emitted here reach connected clients. Without the endpoint it is a
 * no-op (persisted notifications remain the fallback delivery path).
 */

let emitter: Emitter | null = null;
let initialised = false;

function getEmitter(): Emitter | null {
  if (initialised) return emitter;
  initialised = true;

  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) return null;

  try {
    const redisClient = new Redis(url, { lazyConnect: false });
    redisClient.on("error", (err) =>
      console.error("Socket emitter Redis client error:", err.message),
    );
    emitter = new Emitter(redisClient);
  } catch (error) {
    console.error(
      "Failed to initialise socket emitter; live events disabled:",
      error instanceof Error ? error.message : error,
    );
    emitter = null;
  }

  return emitter;
}

export function emitSocketEvent(event: string, payload: unknown): boolean {
  const instance = getEmitter();
  if (!instance) return false;
  instance.emit(event, payload);
  return true;
}
