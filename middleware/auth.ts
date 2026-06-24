import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { Permission, hasAnyPermission } from "../config/rbac";

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface DecodedToken {
  userId?: string;
  id?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export const authenticateWebSocket = (token: string): Promise<DecodedToken> => {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error("Authentication token required"));
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as DecodedToken;
      resolve(decoded);
    } catch (error) {
      reject(new Error("Invalid authentication token"));
    }
  });
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ message: "Access denied. No token provided." });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
    };
    const user = await User.findById(decoded.id).select("-password");

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
  } catch (error) {
    res.status(401).json({ message: "Token is not valid.", error });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
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

/**
 * Authorize a request if the user's role grants ANY of the given permissions.
 * Prefer this over `authorize(...roles)` — permissions live in config/rbac.ts.
 */
export const requirePermission = (...permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Access denied. No user found." });
      return;
    }

    if (!hasAnyPermission(req.user.role, permissions)) {
      res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
      return;
    }

    next();
  };
};
