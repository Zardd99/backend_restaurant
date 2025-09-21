// pages/api/auth/update.ts
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

    const { name, phone } = req.body;

    // Build update object with only provided fields
    const updateData: { name?: string; phone?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided for update",
      });
    }

    const user = await User.findByIdAndUpdate(session.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
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
}
