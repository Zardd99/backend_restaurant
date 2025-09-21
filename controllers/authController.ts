import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { AuthRequest } from "../middleware/auth";

/**
 * Generates a JWT token for a user ID
 * @param id - User ID to encode in the token
 * @returns Signed JWT token string
 */
const generateToken = (id: string): string => {
  // check if JWT secret is available
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  // Create the options object for token expiration
  const options: jwt.SignOptions = {
    expiresIn:
      (process.env.JWT_EXPIRE as jwt.SignOptions["expiresIn"]) || "30d",
  };

  return jwt.sign({ id }, process.env.JWT_SECRET, options);
};
/**
 * POST /api/auth/register
 * Register a new user
 * @param req - Express request object containing user details
 * @param res - Express response object
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400).json({
        message: "Name, email, and password are required",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists with this email" });
      return;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "customer",
      phone,
    });

    // Generate token
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
  } catch (error: unknown) {
    interface ValidationError {
      name: string;
      errors: { [key: string]: { message: string } };
    }

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      res.status(500).json({
        message: "Server error creating user",
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
};

/**
 * POST /api/auth/login
 * Login user with email and password
 * @param req - Express request object containing credentials
 * @param res - Express response object
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        message: "Email and password are required",
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(401).json({
        message: "Account is deactivated. Please contact administrator.",
      });
      return;
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Generate token
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
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({
      message: "Server error during login",
      error: errorMessage,
    });
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 * @param req - Authenticated Express request object
 * @param res - Express response object
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({
      message: "Server error during login",
      error: errorMessage,
    });
  }
};

/**
 * PUT /api/auth/update
 * Update authenticated user's profile
 * @param req - Authenticated Express request object with update data
 * @param res - Express response object
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, phone } = req.body;

    // Build update object with only provided fields
    const updateData: { name?: string; phone?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        message: "No valid fields provided for update",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(req.user!._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    interface ValidationError {
      name: string;
      errors: { [key: string]: { message: string } };
    }

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      res.status(500).json({
        message: "Server error creating user",
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
};

/**
 * PUT /api/auth/change-password
 * Change authenticated user's password
 * @param req - Authenticated Express request object with password data
 * @param res - Express response object
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        message: "Current password and new password are required",
      });
      return;
    }

    // Check if new password is different
    if (currentPassword === newPassword) {
      res.status(400).json({
        message: "New password must be different from current password",
      });
      return;
    }

    const user = await User.findById(req.user!._id).select("+password");

    // Check current password
    const isMatch = await user!.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    // Update password
    user!.password = newPassword;
    await user!.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: unknown) {
    interface ValidationError {
      name: string;
      errors: { [key: string]: { message: string } };
    }

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      res.status(500).json({
        message: "Server error creating user",
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
};
