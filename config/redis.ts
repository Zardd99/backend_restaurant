import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Shared REST-based Upstash Redis client.
 *
 * Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the
 * environment. Safe to share across all replicas — every call is a stateless
 * HTTP request, so this single instance backs rate limiting, idempotency, and
 * distributed locks without any process-local coupling.
 */
export const redis: Redis = Redis.fromEnv();

export default redis;
