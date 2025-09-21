import { NextApiRequest, NextApiResponse } from "next";
import User from "../../models/User";
import { connectDB } from "../../utils/db";
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
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate token
    const token = generateToken(user._id.toString());

    return res.json({
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
    return res.status(500).json({
      message: "Server error during login",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
