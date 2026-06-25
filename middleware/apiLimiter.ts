import rateLimiter from "./rateLimter";

export const apiLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 600,
  message: "Too many requests. Please slow down and try again shortly.",
});
