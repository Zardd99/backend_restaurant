import { NextApiRequest, NextApiResponse } from "next";
import User from "../../../models/User";
import { connectDB } from "../../../utils/db";
import jwt from "jsonwebtoken";

/**
 * Generates a JWT token for a user ID
 */
const generateToken = (id: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not defined");
  }

  const options: jwt.SignOptions = {
    expiresIn:
      (process.env.JWT_EXPIRE as jwt.SignOptions["expiresIn"]) || "30d",
  };

  return jwt.sign({ id }, process.env.JWT_SECRET, options);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await connectDB();
    const { name, email, password, role, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
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

    return res.status(201).json({
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
}
