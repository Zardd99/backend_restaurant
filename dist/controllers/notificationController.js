"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAllNotifications = exports.markAllRead = exports.getNotifications = void 0;
const Notification_1 = __importDefault(require("../models/Notification"));
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const getNotifications = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));
        const skip = (page - 1) * limit;
        const validTypes = ["order_created", "order_preparing", "order_ready", "order_served"];
        const typeParam = req.query.type;
        const filter = typeParam && validTypes.includes(typeParam)
            ? { type: typeParam }
            : {};
        const [data, total] = await Promise.all([
            Notification_1.default.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
            Notification_1.default.countDocuments(filter),
        ]);
        res.json({
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getNotifications = getNotifications;
const markAllRead = async (_req, res) => {
    try {
        await Notification_1.default.updateMany({ read: false }, { read: true });
        res.json({ message: "All notifications marked as read" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.markAllRead = markAllRead;
const deleteAllNotifications = async (_req, res) => {
    try {
        await Notification_1.default.deleteMany({});
        res.json({ message: "All notifications cleared" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.deleteAllNotifications = deleteAllNotifications;
//# sourceMappingURL=notificationController.js.map