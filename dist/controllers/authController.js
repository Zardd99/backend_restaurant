"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfile = exports.getMe = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET environment variable is not defined");
    }
    const options = {
        expiresIn: process.env.JWT_EXPIRE || "30d",
    };
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, options);
};
const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({
                message: "Name, email, and password are required",
            });
            return;
        }
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists with this email" });
            return;
        }
        const user = await User_1.default.create({
            name,
            email,
            password,
            role: role || "customer"
        });
        const token = generateToken(user._id.toString());
        res.status(201).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
            },
        });
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "ValidationError") {
            const validationError = error;
            const errors = Object.values(validationError.errors).map((err) => err.message);
            res.status(400).json({ message: "Validation error", errors });
        }
        else {
            res.status(500).json({
                message: "Server error creating user",
                error: error instanceof Error ? error.message : "An unknown error occurred",
            });
        }
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                message: "Email and password are required",
            });
            return;
        }
        const user = await User_1.default.findOne({ email }).select("+password");
        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        if (!user.isActive) {
            res.status(401).json({
                message: "Account is deactivated. Please contact administrator.",
            });
            return;
        }
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        const token = generateToken(user._id.toString());
        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        res.status(500).json({
            message: "Server error during login",
            error: errorMessage,
        });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        res.status(500).json({
            message: "Server error during login",
            error: errorMessage,
        });
    }
};
exports.getMe = getMe;
const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        if (Object.keys(updateData).length === 0) {
            res.status(400).json({
                message: "No valid fields provided for update",
            });
            return;
        }
        const user = await User_1.default.findByIdAndUpdate(req.user._id, updateData, {
            new: true,
            runValidators: true,
        });
        res.json({
            success: true,
            user,
        });
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "ValidationError") {
            const validationError = error;
            const errors = Object.values(validationError.errors).map((err) => err.message);
            res.status(400).json({ message: "Validation error", errors });
        }
        else {
            res.status(500).json({
                message: "Server error creating user",
                error: error instanceof Error ? error.message : "An unknown error occurred",
            });
        }
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                message: "Current password and new password are required",
            });
            return;
        }
        if (currentPassword === newPassword) {
            res.status(400).json({
                message: "New password must be different from current password",
            });
            return;
        }
        const user = await User_1.default.findById(req.user._id).select("+password");
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({ message: "Current password is incorrect" });
            return;
        }
        user.password = newPassword;
        await user.save();
        res.json({
            success: true,
            message: "Password updated successfully",
        });
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "name" in error &&
            error.name === "ValidationError") {
            const validationError = error;
            const errors = Object.values(validationError.errors).map((err) => err.message);
            res.status(400).json({ message: "Validation error", errors });
        }
        else {
            res.status(500).json({
                message: "Server error creating user",
                error: error instanceof Error ? error.message : "An unknown error occurred",
            });
        }
    }
};
exports.changePassword = changePassword;
//# sourceMappingURL=authController.js.map