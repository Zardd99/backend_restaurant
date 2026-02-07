import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { AuthRequest } from "../middleware/auth";

/**
 * Generate a signed JWT for authentication
 * @param id - MongoDB user ID to embed in the token payload
 * @returns JWT access token
 */
const generateToken = (id: string): string => {
  // Ensure JWT secret is configured before signing tokens
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  // Configure token expiration (defaults to 30 days)
  const options: jwt.SignOptions = {
    expiresIn:
      (process.env.JWT_EXPIRE as jwt.SignOptions["expiresIn"]) || "30d",
  };

  // Sign and return the JWT
  return jwt.sign({ id }, process.env.JWT_SECRET, options);
};

/**
 * POST /api/auth/register
 * Create a new user account
 * @param req - Request containing registration payload
 * @param res - HTTP response
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // Validate mandatory registration fields
    if (!name || !email || !password) {
      res.status(400).json({
        message: "Name, email, and password are required",
      });
      return;
    }

    // Prevent duplicate account creation using the same email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists with this email" });
      return;
    }

    // Persist new user to the database
    const user = await User.create({
      name,
      email,
      password,
      role: role || "customer",
    });

    // Issue authentication token after successful registration
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

    // Handle schema validation errors explicitly
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message,
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      // Fallback for unexpected server-side errors
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
 * Authenticate user credentials and issue JWT
 * @param req - Request containing login credentials
 * @param res - HTTP response
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate login payload
    if (!email || !password) {
      res.status(400).json({
        message: "Email and password are required",
      });
      return;
    }

    // Retrieve user and include password for verification
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Block login attempts for deactivated accounts
    if (!user.isActive) {
      res.status(401).json({
        message: "Account is deactivated. Please contact administrator.",
      });
      return;
    }

    // Compare provided password with stored hash
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Issue authentication token
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
    // Handle unexpected authentication errors
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
 * Retrieve the authenticated user's profile
 * @param req - Request populated by authentication middleware
 * @param res - HTTP response
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error: Error | unknown) {
    // Handle unexpected profile retrieval errors
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({
      message: "Server error retrieving user profile",
      error: errorMessage,
    });
  }
};

/**
 * PUT /api/auth/update
 * Update authenticated user's profile details
 * @param req - Request containing allowed profile updates
 * @param res - HTTP response
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, phone } = req.body;

    // Build a partial update object from provided fields only
    const updateData: { name?: string; phone?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    // Reject requests with no valid update fields
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        message: "No valid fields provided for update",
      });
      return;
    }

    // Apply updates and return the updated user document
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

    // Handle schema validation failures
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message,
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      // Handle unexpected update failures
      res.status(500).json({
        message: "Server error updating user profile",
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
};

/**
 * PUT /api/auth/change-password
 * Update password for the authenticated user
 * @param req - Request containing current and new password
 * @param res - HTTP response
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate password change payload
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        message: "Current password and new password are required",
      });
      return;
    }

    // Prevent reusing the same password
    if (currentPassword === newPassword) {
      res.status(400).json({
        message: "New password must be different from current password",
      });
      return;
    }

    // Load user with password field for verification
    const user = await User.findById(req.user!._id).select("+password");

    // Verify current password correctness
    const isMatch = await user!.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    // Persist new password (hashing handled by model middleware)
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

    // Handle validation-related failures
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      const validationError = error as ValidationError;
      const errors = Object.values(validationError.errors).map(
        (err) => err.message,
      );
      res.status(400).json({ message: "Validation error", errors });
    } else {
      // Handle unexpected password update errors
      res.status(500).json({
        message: "Server error changing password",
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
};
