import { CheckLowStockUseCase } from "../use-cases/check-low-stock-use-case";
import { ConsumeIngredientsUseCase } from "../use-cases/consume-ingredients-use-case";
import { EmailService } from "../../services/email-service";
import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { IngredientRepository } from "../../repositories/ingredient-repository";
import { Result, ok, err } from "../../shared/result";
import { ConsumptionResult } from "../../models/ingredient";

/**
 * Configuration for the Inventory Alerting System.
 */
export interface AlertConfig {
  recipients: Array<{ email: string; name?: string }>;
  checkIntervalMinutes: number;
  thresholdPercentage: number;
  enableEmailAlerts: boolean;
  enableRealTimeAlerts: boolean;
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  menuItemName?: string;
}

/**
 * InventoryManager Orchestrator
 * * Responsibilities:
 * 1. Coordinates ingredient consumption during order processing.
 * 2. Manages scheduled low-stock audits via a polling interval.
 * 3. Handles an asynchronous real-time alert queue to prevent blocking the main order flow.
 */
export class InventoryManager {
  private alertCheckInterval?: NodeJS.Timeout;

  // Queue to manage high-frequency alerts without overwhelming the email service
  private realTimeAlertQueue: Array<{
    ingredientId: string;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    unit: string;
    timestamp: Date;
  }> = [];

  constructor(
    private checkLowStockUseCase: CheckLowStockUseCase,
    private consumeIngredientsUseCase: ConsumeIngredientsUseCase,
    private emailService: EmailService,
    private notificationRepository: LowStockNotificationRepository,
    private ingredientRepository: IngredientRepository,
    private alertConfig: AlertConfig,
  ) {}

  /**
   * Main entry point for inventory reduction when a sale occurs.
   * Processes items sequentially to ensure stock integrity.
   */
  async processOrder(orderItems: OrderItem[]): Promise<
    Result<{
      successful: boolean;
      consumedIngredients: ConsumptionResult[];
      failedItems: Array<{ menuItemId: string; error: string }>;
    }>
  > {
    try {
      const results: ConsumptionResult[] = [];
      const failedItems: Array<{ menuItemId: string; error: string }> = [];

      for (const item of orderItems) {
        const consumeResult = await this.consumeIngredientsForMenuItem(
          item.menuItemId,
          item.quantity,
        );

        if (consumeResult.success) {
          results.push(...consumeResult.value);

          // Trigger alerts for ingredients that dropped below safety thresholds
          for (const consumption of consumeResult.value) {
            if (consumption.needsReorder) {
              const ingredientResult = await this.ingredientRepository.findById(
                consumption.ingredientId,
              );
              if (ingredientResult.success && ingredientResult.value) {
                const ingredient = ingredientResult.value;
                await this.sendRealTimeAlert({
                  ingredientId: consumption.ingredientId,
                  ingredientName: ingredient.name,
                  currentStock: consumption.remainingStock,
                  minStock: ingredient.minStock,
                  unit: ingredient.unit,
                  timestamp: new Date(),
                });
              }
            }
          }
        } else {
          failedItems.push({
            menuItemId: item.menuItemId,
            error: consumeResult.error.message,
          });
        }
      }

      return ok({
        successful: failedItems.length === 0,
        consumedIngredients: results,
        failedItems,
      });
    } catch (error) {
      return err(
        new Error(
          `Failed to process order: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async consumeIngredientsForMenuItem(
    menuItemId: string,
    quantity: number,
  ): Promise<Result<ConsumptionResult[]>> {
    try {
      const consumeResult = await this.consumeIngredientsUseCase.execute({
        menuItemId,
        quantity,
      });

      if (!consumeResult.success) {
        return err(consumeResult.error);
      }

      return ok(consumeResult.value.consumptionResults);
    } catch (error) {
      return err(
        new Error(
          `Failed to consume ingredients: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  /**
   * Manual or Scheduled check for all low stock items.
   * Distinguishes between 'Critical' (at/below Min) and 'Low' (at/below Reorder Point).
   */
  async checkAndAlertLowStock(): Promise<
    Result<{
      lowStockCount: number;
      criticalStockCount: number;
      emailsSent: number;
      notificationsCreated: number;
    }>
  > {
    try {
      const checkResult = await this.checkLowStockUseCase.execute();
      if (!checkResult.success) {
        return checkResult;
      }

      const { lowStockIngredients, notificationsCreated } = checkResult.value;

      if (lowStockIngredients.length === 0) {
        return ok({
          lowStockCount: 0,
          criticalStockCount: 0,
          emailsSent: 0,
          notificationsCreated: 0,
        });
      }

      let emailsSent = 0;
      if (
        this.alertConfig.enableEmailAlerts &&
        this.alertConfig.recipients.length > 0
      ) {
        const emailContent =
          this.createLowStockAlertContent(lowStockIngredients);

        for (const recipient of this.alertConfig.recipients) {
          const emailResult = await this.emailService.send(
            recipient,
            emailContent,
          );
          if (emailResult.success) emailsSent++;
        }
      }

      const criticalStockCount = lowStockIngredients.filter(
        (ing) => ing.currentStock <= ing.minStock,
      ).length;

      return ok({
        lowStockCount: lowStockIngredients.length,
        criticalStockCount,
        emailsSent,
        notificationsCreated,
      });
    } catch (error) {
      return err(
        new Error(
          `Failed to check and alert low stock: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  /**
   * Queues an alert for asynchronous processing.
   * This prevents latency in the checkout/order flow.
   */
  private async sendRealTimeAlert(alertData: {
    ingredientId: string;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    unit: string;
    timestamp: Date;
  }): Promise<void> {
    if (!this.alertConfig.enableRealTimeAlerts) return;

    this.realTimeAlertQueue.push(alertData);

    // Start processing if the queue was previously empty
    if (this.realTimeAlertQueue.length === 1) {
      setTimeout(() => this.processRealTimeAlerts(), 1000);
    }
  }

  /**
   * Recursive worker that processes one alert at a time from the queue.
   */
  private async processRealTimeAlerts(): Promise<void> {
    if (this.realTimeAlertQueue.length === 0) return;

    const alert = this.realTimeAlertQueue.shift();
    if (!alert) return;

    try {
      const emailContent = this.createRealTimeAlertContent([
        {
          ingredientName: alert.ingredientName,
          currentStock: alert.currentStock,
          minStock: alert.minStock,
          unit: alert.unit,
        },
      ]);

      for (const recipient of this.alertConfig.recipients) {
        await this.emailService.send(recipient, {
          ...emailContent,
          subject: `URGENT: ${alert.ingredientName} is running low!`,
        });
      }
    } catch (error) {
      console.error(
        "Critical Failure: Real-time alert worker encountered an error:",
        error,
      );
    }

    // Recurse to handle the next item in queue
    this.processRealTimeAlerts();
  }

  /**
   * Starts the background polling task for periodic stock audits.
   */
  startAutomaticAlerts(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    this.alertCheckInterval = setInterval(
      async () => {
        await this.checkAndAlertLowStock();
      },
      this.alertConfig.checkIntervalMinutes * 60 * 1000,
    );

    this.checkAndAlertLowStock();
  }

  /**
   * Clear the interval to prevent memory leaks or floating tasks during shutdown.
   */
  stopAutomaticAlerts(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }
  }

  // --- Content Generators ---

  private createLowStockAlertContent(
    ingredients: Array<{
      id: string;
      name: string;
      currentStock: number;
      minStock: number;
      reorderPoint: number;
      unit: string;
    }>,
  ) {
    const criticalItems = ingredients.filter(
      (i) => i.currentStock <= i.minStock,
    );
    const lowItems = ingredients.filter(
      (i) => i.currentStock > i.minStock && i.currentStock <= i.reorderPoint,
    );

    const criticalList = criticalItems
      .map(
        (i) =>
          `🚨 ${i.name}: ${i.currentStock}${i.unit} (Min: ${i.minStock}${i.unit}) - CRITICAL`,
      )
      .join("\n");

    const lowList = lowItems
      .map(
        (i) =>
          `⚠️ ${i.name}: ${i.currentStock}${i.unit} (Reorder at: ${i.reorderPoint}${i.unit})`,
      )
      .join("\n");

    const itemsList = `${criticalList}${criticalList && lowList ? "\n\n" : ""}${lowList}`;

    return {
      subject: `Low Stock Alert - ${ingredients.length} Item(s) Need Attention`,
      body: `The following ingredients are running low on stock:\n\n${itemsList}\n\nPlease replenish these items as soon as possible.\n\nTimestamp: ${new Date().toLocaleString()}`,
      isHtml: false,
    };
  }

  private createRealTimeAlertContent(
    ingredients: Array<{
      ingredientName: string;
      currentStock: number;
      minStock: number;
      unit: string;
    }>,
  ) {
    const itemsList = ingredients
      .map(
        (n) =>
          `• ${n.ingredientName}: ${n.currentStock}${n.unit} remaining (Min: ${n.minStock}${n.unit})`,
      )
      .join("\n");

    return {
      subject: `Real-time Low Stock Alert`,
      body: `An ingredient has reached low stock levels:\n\n${itemsList}\n\nThis alert was triggered by recent sales activity.\n\nTimestamp: ${new Date().toLocaleString()}`,
      isHtml: false,
    };
  }
}
