"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const menuController_1 = require("../../controllers/menuController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.get("/", menuController_1.getAllMenu);
router.get("/:id", menuController_1.getMenuId);
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)("menu:write"), menuController_1.createMenu);
router.put("/:id", auth_1.authenticate, (0, auth_1.requirePermission)("menu:write"), menuController_1.updateMenu);
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)("menu:write"), menuController_1.deleteMenuItem);
exports.default = router;
//# sourceMappingURL=menu.js.map