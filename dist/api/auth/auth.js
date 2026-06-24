"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../../controllers/authController");
const auth_1 = require("../../middleware/auth");
const rateLimter_1 = __importDefault(require("../../middleware/rateLimter"));
const router = express_1.default.Router();
const authLimiter = (0, rateLimter_1.default)({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: "Too many attempts. Please try again later.",
    skipFailedRequests: false,
});
router.post("/register", authLimiter, authController_1.register);
router.post("/login", authLimiter, authController_1.login);
router.get("/me", auth_1.authenticate, authController_1.getMe);
router.put("/update", auth_1.authenticate, authController_1.updateProfile);
router.put("/change-password", auth_1.authenticate, authController_1.changePassword);
exports.default = router;
//# sourceMappingURL=auth.js.map