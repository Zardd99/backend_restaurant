import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { connectDB } from "../../utils/db";
import users from "../../models/User";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
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

    // Get user from database
    const user = await users.findById(session.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
