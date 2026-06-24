"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.authorize = exports.authenticate = exports.authenticateWebSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const rbac_1 = require("../config/rbac");
const authenticateWebSocket = (token) => {
    return new Promise((resolve, reject) => {
        if (!token) {
            reject(new Error("Authentication token required"));
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            resolve(decoded);
        }
        catch (error) {
            reject(new Error("Invalid authentication token"));
        }
    });
};
exports.authenticateWebSocket = authenticateWebSocket;
const authenticate = async (req, res, next) => {
    var _a;
    try {
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
        if (!token) {
            res.status(401).json({ message: "Access denied. No token provided." });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await User_1.default.findById(decoded.id).select("-password");
        if (!user) {
            res.status(401).json({ message: "Token is not valid." });
            return;
        }
        if (!user.isActive) {
            res.status(401).json({ message: "Account is deactivated." });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Token is not valid.", error });
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ message: "Access denied. No user found." });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: "Access denied. Insufficient role." });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
const requirePermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ message: "Access denied. No user found." });
            return;
        }
        if (!(0, rbac_1.hasAnyPermission)(req.user.role, permissions)) {
            res
                .status(403)
                .json({ message: "Access denied. Insufficient permissions." });
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
//# sourceMappingURL=auth.js.map