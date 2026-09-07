"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = void 0;
const rateLimter_1 = __importDefault(require("./rateLimter"));
exports.apiLimiter = (0, rateLimter_1.default)({
    windowMs: 60 * 1000,
    maxRequests: 600,
    message: "Too many requests. Please slow down and try again shortly.",
});
//# sourceMappingURL=apiLimiter.js.map