import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth";
import { isRole } from "../config/rbac";

const isLastActiveAdmin = async (userId: string): Promise<boolean> => {
  const target = await User.findById(userId);
  if (!target || target.role !== "admin") return false;
  const activeAdmins = await User.countDocuments({
    role: "admin",
    isActive: true,
  });
  return activeAdmins <= 1;
};

/**
 * GET /api/users
 * Get all users (Admin only)
 */
export const getUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const users = await User.find().select("-password");
    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error: unknown) {
    console.error("user controller error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/users/:id
 * Get user by ID (Admin only)
 */
export const getUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    console.error("user controller error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/users/:id
 * Update user (Admin only)
 */
export const updateUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, role, phone, isActive } = req.body;

    const demotesLastAdmin =
      (role !== undefined && role !== "admin") || isActive === false;
    if (demotesLastAdmin && (await isLastActiveAdmin(req.params.id as string))) {
      res
        .status(409)
        .json({ message: "Cannot demote or deactivate the last active admin." });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, phone, isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    console.error("user controller error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/users/:id/role
 * Assign a role to a user (user:manage). Refuses to demote the last active admin.
 */
export const updateUserRole = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { role } = req.body;

    if (!isRole(role)) {
      res.status(400).json({ message: "Invalid role" });
      return;
    }

    if (role !== "admin" && (await isLastActiveAdmin(req.params.id as string))) {
      res
        .status(409)
        .json({ message: "Cannot demote the last active admin." });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ success: true, user });
  } catch (error: unknown) {
    console.error("updateUserRole error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/users/:id
 * Delete user (Admin only)
 */
export const deleteUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (await isLastActiveAdmin(req.params.id as string)) {
      res
        .status(409)
        .json({ message: "Cannot delete the last active admin." });
      return;
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: unknown) {
    console.error("user controller error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
