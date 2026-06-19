import { Router, Request, Response } from "express";
import { orderTimeoutService } from "../../services/OrderTimeoutService";

const router = Router();

/**
 * POST /api/order/:orderId/init-prep
 * Initialize order preparation with timeout
 */
router.post(
  "/api/order/:orderId/init-prep",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { timeoutMinutes } = req.body;

      const order = await orderTimeoutService.initializePrepTimeout(
        orderId,
        timeoutMinutes,
      );

      if (!order) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      res.json({
        message: "Order prep initialized with timeout",
        order,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error initializing prep timeout",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/order/:orderId/prep-step
 * Update prep step progress
 */
router.post(
  "/api/order/:orderId/prep-step",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { stepName, status, notes } = req.body;

      if (!stepName || !status) {
        res.status(400).json({
          message: "stepName and status are required",
        });
        return;
      }

      const prepProgress = await orderTimeoutService.updatePrepProgress(
        orderId,
        stepName,
        status,
        notes,
      );

      res.json({
        message: "Prep step updated",
        prepProgress,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error updating prep step",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/order/:orderId/prep-progress
 * Get prep progress for an order
 */
router.get(
  "/api/order/:orderId/prep-progress",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      const prepProgress = await orderTimeoutService.getPrepProgress(orderId);

      if (!prepProgress) {
        res.status(404).json({
          message: "Prep progress not found for this order",
        });
        return;
      }

      res.json(prepProgress);
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching prep progress",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/order/:orderId/timeout-status
 * Get timeout status for an order
 */
router.get(
  "/api/order/:orderId/timeout-status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      const status = await orderTimeoutService.getTimeoutStatus(orderId);

      if (!status) {
        res.status(404).json({
          message: "Order not found",
        });
        return;
      }

      res.json(status);
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching timeout status",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/order/:orderId/extend-timeout
 * Extend timeout for an order
 */
router.post(
  "/api/order/:orderId/extend-timeout",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { additionalMinutes } = req.body;

      if (!additionalMinutes || additionalMinutes <= 0) {
        res.status(400).json({
          message: "additionalMinutes must be a positive number",
        });
        return;
      }

      const order = await orderTimeoutService.extendTimeout(
        orderId,
        additionalMinutes,
      );

      if (!order) {
        res.status(404).json({
          message: "Order not found",
        });
        return;
      }

      res.json({
        message: `Timeout extended by ${additionalMinutes} minutes`,
        order,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error extending timeout",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/order/:orderId/cancel
 * Manually cancel an order
 */
router.post(
  "/api/order/:orderId/cancel",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await orderTimeoutService.cancelOrder(
        orderId,
        reason || "Manually cancelled by user",
      );

      if (!order) {
        res.status(404).json({
          message: "Order not found",
        });
        return;
      }

      res.json({
        message: "Order cancelled",
        order,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error cancelling order",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/timeout/check-expired
 * Manually trigger timeout check (admin only)
 */
router.post(
  "/api/timeout/check-expired",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cancelledCount =
        await orderTimeoutService.checkAndCancelTimedOutOrders();
      const failedSteps = await orderTimeoutService.checkTimedOutPrepSteps();

      res.json({
        message: "Timeout check completed",
        stats: {
          cancelledOrders: cancelledCount,
          failedSteps,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error checking timeouts",
        error: error.message,
      });
    }
  },
);

export default router;
