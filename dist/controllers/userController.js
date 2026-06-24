"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.updateUser = exports.getUser = exports.getUsers = void 0;
const User_1 = __importDefault(require("../models/User"));
const rbac_1 = require("../config/rbac");
const isLastActiveAdmin = async (userId) => {
    const target = await User_1.default.findById(userId);
    if (!target || target.role !== "admin")
        return false;
    const activeAdmins = await User_1.default.countDocuments({
        role: "admin",
        isActive: true,
    });
    return activeAdmins <= 1;
};
const getUsers = async (req, res) => {
    try {
        const users = await User_1.default.find().select("-password");
        res.json({
            success: true,
            count: users.length,
            users,
        });
    }
    catch (error) {
        console.error("user controller error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getUsers = getUsers;
const getUser = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id).select("-password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({
            success: true,
            user,
        });
    }
    catch (error) {
        console.error("user controller error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getUser = getUser;
const updateUser = async (req, res) => {
    try {
        const { name, email, role, phone, isActive } = req.body;
        const demotesLastAdmin = (role !== undefined && role !== "admin") || isActive === false;
        if (demotesLastAdmin && (await isLastActiveAdmin(req.params.id))) {
            res
                .status(409)
                .json({ message: "Cannot demote or deactivate the last active admin." });
            return;
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { name, email, role, phone, isActive }, { new: true, runValidators: true }).select("-password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({
            success: true,
            user,
        });
    }
    catch (error) {
        console.error("user controller error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateUser = updateUser;
const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!(0, rbac_1.isRole)(role)) {
            res.status(400).json({ message: "Invalid role" });
            return;
        }
        if (role !== "admin" && (await isLastActiveAdmin(req.params.id))) {
            res
                .status(409)
                .json({ message: "Cannot demote the last active admin." });
            return;
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true }).select("-password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({ success: true, user });
    }
    catch (error) {
        console.error("updateUserRole error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateUserRole = updateUserRole;
const deleteUser = async (req, res) => {
    try {
        if (await isLastActiveAdmin(req.params.id)) {
            res
                .status(409)
                .json({ message: "Cannot delete the last active admin." });
            return;
        }
        const user = await User_1.default.findByIdAndDelete(req.params.id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({
            success: true,
            message: "User deleted successfully",
        });
    }
    catch (error) {
        console.error("user controller error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteUser = deleteUser;
//# sourceMappingURL=userController.js.map