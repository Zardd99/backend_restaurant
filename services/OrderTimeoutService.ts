import Order, { IOrder } from "../models/Order";
import ChefPrepProgress, {
  IChefPrepProgress,
} from "../models/ChefPrepProgress";
import { Types } from "mongoose";

export interface TimeoutConfig {
  defaultPrepTimeoutMinutes?: number;
  checkIntervalSeconds?: number;
  enableAutoCancel?: boolean;
}

export class OrderTimeoutService {
  private checkIntervalSeconds: number;
  private enableAutoCancel: boolean;
  private checkInterval?: NodeJS.Timeout;
  private defaultPrepTimeoutMinutes: number;

  constructor(config: TimeoutConfig = {}) {
    this.defaultPrepTimeoutMinutes = config.defaultPrepTimeoutMinutes || 30;
    this.checkIntervalSeconds = config.checkIntervalSeconds || 60;
    this.enableAutoCancel = config.enableAutoCancel !== false;
  }

  /**
   * Initialize order prep with timeout
   */
  async initializePrepTimeout(
    orderId: string,
    timeoutMinutes?: number,
  ): Promise<IOrder | null> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const timeoutMins = timeoutMinutes || this.defaultPrepTimeoutMinutes;
      const now = new Date();
      const timeoutAt = new Date(now.getTime() + timeoutMins * 60000);

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: "preparing",
          totalPrepTimeoutMinutes: timeoutMins,
          prepStartedAt: now,
          prepTimeoutAt: timeoutAt,
          lastPrepUpdateAt: now,
        },
        { new: true },
      );

      console.log(
        `Order ${orderId} prep initialized with ${timeoutMins} minutes timeout`,
      );
      return updatedOrder;
    } catch (error) {
      console.error(
        `Error initializing prep timeout for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update prep progress and extend timeout if needed
   */
  async updatePrepProgress(
    orderId: string,
    stepName: string,
    status: string,
    notes?: string,
  ): Promise<IChefPrepProgress | null> {
    try {
      // Get or create prep progress
      let prepProgress = await ChefPrepProgress.findOne({
        orderId: new Types.ObjectId(orderId),
      });

      if (!prepProgress) {
        const order = await Order.findById(orderId);
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }

        prepProgress = new ChefPrepProgress({
          orderId: new Types.ObjectId(orderId),
          totalEstimatedMinutes: order.totalPrepTimeoutMinutes || 30,
          overallStatus: "in-progress",
          steps: [],
        });
      }

      // Find or create the step
      const existingStep = prepProgress.steps.find(
        (s) => s.stepName === stepName,
      );
      const now = new Date();

      if (existingStep) {
        existingStep.status = status as any;
        if (status === "in-progress" && !existingStep.startedAt) {
          existingStep.startedAt = now;
          existingStep.timeoutAt = new Date(
            now.getTime() + existingStep.estimatedDurationMinutes * 60000,
          );
        } else if (status === "completed") {
          existingStep.completedAt = now;
        }
        if (notes) {
          existingStep.notes = notes;
        }
      } else {
        prepProgress.steps.push({
          stepName: stepName as any,
          estimatedDurationMinutes: 10, // Default 10 minutes per step
          status: status as any,
          startedAt: status === "in-progress" ? now : undefined,
          completedAt: status === "completed" ? now : undefined,
          timeoutAt: new Date(now.getTime() + 10 * 60000),
          notes,
        });
      }

      // Update prep progress overall status
      const allCompleted = prepProgress.steps.every(
        (s) => s.status === "completed" || s.status === "skipped",
      );
      if (allCompleted) {
        prepProgress.overallStatus = "completed";
        prepProgress.completedAt = now;
      } else if (prepProgress.steps.some((s) => s.status === "in-progress")) {
        prepProgress.overallStatus = "in-progress";
        prepProgress.startedAt = prepProgress.startedAt || now;
      }

      await prepProgress.save();

      // Update order's last prep update time
      await Order.findByIdAndUpdate(
        orderId,
        {
          lastPrepUpdateAt: now,
        },
        { new: true },
      );

      console.log(
        `Prep progress updated for order ${orderId}: ${stepName} - ${status}`,
      );
      return prepProgress;
    } catch (error) {
      console.error(
        `Error updating prep progress for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get prep progress for an order
   */
  async getPrepProgress(orderId: string): Promise<IChefPrepProgress | null> {
    try {
      return await ChefPrepProgress.findOne({
        orderId: new Types.ObjectId(orderId),
      });
    } catch (error) {
      console.error(`Error getting prep progress for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Check for timed out orders and auto-cancel if enabled
   */
  async checkAndCancelTimedOutOrders(): Promise<number> {
    try {
      const now = new Date();

      // Find orders that have timed out
      const timedOutOrders = await Order.find({
        status: "preparing",
        prepTimeoutAt: { $lt: now },
        autoCancel: true,
      });

      let cancelledCount = 0;

      for (const order of timedOutOrders) {
        await this.cancelOrder(
          order._id.toString(),
          "Preparation timeout - no updates for the specified period",
        );
        cancelledCount++;
      }

      if (cancelledCount > 0) {
        console.log(`Auto-cancelled ${cancelledCount} orders due to timeout`);
      }

      return cancelledCount;
    } catch (error) {
      console.error("Error checking for timed out orders:", error);
      return 0;
    }
  }

  /**
   * Check for timed out prep steps
   */
  async checkTimedOutPrepSteps(): Promise<number> {
    try {
      const now = new Date();

      // Find prep progress with timed out steps
      const prepProgressList = await ChefPrepProgress.find({
        overallStatus: { $in: ["pending", "in-progress"] },
        "steps.status": "in-progress",
        "steps.timeoutAt": { $lt: now },
      });

      let timedOutCount = 0;

      for (const prep of prepProgressList) {
        const timedOutSteps = prep.steps.filter(
          (s) => s.status === "in-progress" && s.timeoutAt && s.timeoutAt < now,
        );

        for (const step of timedOutSteps) {
          step.status = "failed";
          step.notes = (step.notes || "") + " [TIMEOUT]";
          timedOutCount++;
        }

        if (timedOutSteps.length > 0) {
          await prep.save();
          console.log(
            `Marked ${timedOutSteps.length} timed out steps as failed for order ${prep.orderId}`,
          );
        }
      }

      return timedOutCount;
    } catch (error) {
      console.error("Error checking for timed out prep steps:", error);
      return 0;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason: string): Promise<IOrder | null> {
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: "cancelled",
          cancelledReason: reason,
        },
        { new: true },
      );

      // Also cancel associated prep progress
      const prepProgress = await ChefPrepProgress.findOneAndUpdate(
        { orderId: new Types.ObjectId(orderId) },
        {
          overallStatus: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason,
        },
        { new: true },
      );

      console.log(`Order ${orderId} cancelled: ${reason}`);
      return updatedOrder;
    } catch (error) {
      console.error(`Error cancelling order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Extend timeout for an order (e.g., when chef needs more time)
   */
  async extendTimeout(
    orderId: string,
    additionalMinutes: number,
  ): Promise<IOrder | null> {
    try {
      const order = await Order.findById(orderId);
      if (!order || !order.prepTimeoutAt) {
        throw new Error(`Order ${orderId} not found or prep not started`);
      }

      const newTimeoutAt = new Date(
        order.prepTimeoutAt.getTime() + additionalMinutes * 60000,
      );

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          prepTimeoutAt: newTimeoutAt,
          lastPrepUpdateAt: new Date(),
        },
        { new: true },
      );

      console.log(
        `Order ${orderId} timeout extended by ${additionalMinutes} minutes`,
      );
      return updatedOrder;
    } catch (error) {
      console.error(`Error extending timeout for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get timeout status for an order
   */
  async getTimeoutStatus(orderId: string): Promise<{
    orderId: string;
    status: string;
    timeoutAt?: Date;
    timeoutInMinutes?: number;
    isExpired: boolean;
    prepSteps?: any[];
  } | null> {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return null;
      }

      const prepProgress = await ChefPrepProgress.findOne({
        orderId: new Types.ObjectId(orderId),
      });

      const now = new Date();
      const isExpired =
        order.prepTimeoutAt != null && order.prepTimeoutAt < now;
      const timeoutInMinutes = order.prepTimeoutAt
        ? Math.round((order.prepTimeoutAt.getTime() - now.getTime()) / 60000)
        : undefined;

      return {
        orderId: order._id.toString(),
        status: order.status,
        timeoutAt: order.prepTimeoutAt,
        timeoutInMinutes:
          timeoutInMinutes != null && timeoutInMinutes > 0
            ? timeoutInMinutes
            : 0,
        isExpired,
        prepSteps: prepProgress?.steps.map((s) => ({
          name: s.stepName,
          status: s.status,
          timeoutAt: s.timeoutAt,
          isExpired: s.timeoutAt != null && s.timeoutAt < now,
        })),
      };
    } catch (error) {
      console.error(
        `Error getting timeout status for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Start the timeout checker interval
   */
  startTimeoutChecker(): void {
    if (this.checkInterval) {
      console.log("Timeout checker already running");
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        const cancelledCount = await this.checkAndCancelTimedOutOrders();
        const failedSteps = await this.checkTimedOutPrepSteps();

        if (cancelledCount > 0 || failedSteps > 0) {
          console.log(
            `Timeout check: Cancelled ${cancelledCount} orders, Failed ${failedSteps} steps`,
          );
        }
      } catch (error) {
        console.error("Error in timeout checker:", error);
      }
    }, this.checkIntervalSeconds * 1000);

    console.log(
      `Timeout checker started (interval: ${this.checkIntervalSeconds}s)`,
    );
  }

  /**
   * Stop the timeout checker interval
   */
  stopTimeoutChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log("Timeout checker stopped");
    }
  }
}

// Export singleton instance
export const orderTimeoutService = new OrderTimeoutService({
  defaultPrepTimeoutMinutes: 30,
  checkIntervalSeconds: 60,
  enableAutoCancel: true,
});
