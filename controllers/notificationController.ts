import { Request, Response } from "express";
import Notification, { NotificationType } from "../models/Notification";
import { AuthRequest } from "../middleware/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const getNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const validTypes: NotificationType[] = ["order_created", "order_preparing", "order_ready", "order_served"];
    const typeParam = req.query.type as string | undefined;
    const filter = typeParam && (validTypes as string[]).includes(typeParam)
      ? { type: typeParam as NotificationType }
      : {};

    const [data, total] = await Promise.all([
      Notification.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const markAllRead = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const deleteAllNotifications = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    await Notification.deleteMany({});
    res.json({ message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
