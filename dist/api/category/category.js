"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../../controllers/categoryController");
const router = express_1.default.Router();
router.get("/", categoryController_1.getAllCategory);
exports.default = router;
//# sourceMappingURL=category.js.map