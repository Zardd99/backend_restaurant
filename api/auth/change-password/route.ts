import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import User from "../../../models/User";
import { connectDB } from "../../../utils/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await connectDB();

    // Get user session for authentication
    const session = await getSession({ req });

    // Check authentication
    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    // Check if new password is different
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    const user = await User.findById(session.user.id).select("+password");

    // Check current password
    const isMatch = await user!.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user!.password = newPassword;
    await user!.save();

    return res.json({
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
}
