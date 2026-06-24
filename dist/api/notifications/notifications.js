"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middleware/auth");
const notificationController_1 = require("../../controllers/notificationController");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get("/", (0, auth_1.requirePermission)("notification:read"), notificationController_1.getNotifications);
router.patch("/read", (0, auth_1.requirePermission)("notification:read"), notificationController_1.markAllRead);
router.delete("/", (0, auth_1.requirePermission)("notification:manage"), notificationController_1.deleteAllNotifications);
exports.default = router;
//# sourceMappingURL=notifications.js.map