import { CheckLowStockUseCase } from "../use-cases/check-low-stock-use-case";
import { ConsumeIngredientsUseCase } from "../use-cases/consume-ingredients-use-case";
import { EmailService } from "../../services/email-service";
import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { Result, ok, err } from "../../shared/result";

export interface AlertConfig {
  recipients: Array<{ email: string; name?: string }>;
  checkIntervalMinutes: number;
  thresholdPercentage: number;
}

export class InventoryManager {
  private alertCheckInterval?: NodeJS.Timeout;

  constructor(
    private checkLowStockUseCase: CheckLowStockUseCase,
    private consumeIngredientsUseCase: ConsumeIngredientsUseCase,
    private emailService: EmailService,
    private notificationRepository: LowStockNotificationRepository,
    private alertConfig: AlertConfig,
  ) {}

  async consumeIngredientsForMenuItem(
    menuItemId: string,
    quantity: number,
  ): Promise<Result<void>> {
    return this.consumeIngredientsUseCase.execute({
      menuItemId,
      quantity,
    });
  }

  async checkAndAlertLowStock(): Promise<
    Result<{
      lowStockCount: number;
      emailsSent: number;
    }>
  > {
    try {
      // Check for low stock
      const checkResult = await this.checkLowStockUseCase.execute();
      if (!checkResult.success) {
        return checkResult;
      }

      const { lowStockIngredients } = checkResult.value;

      if (lowStockIngredients === 0) {
        return ok({ lowStockCount: 0, emailsSent: 0 });
      }

      // Get unacknowledged notifications
      const notificationsResult =
        await this.notificationRepository.findUnacknowledged();

      if (!notificationsResult.success) {
        return notificationsResult;
      }

      const notifications = notificationsResult.value;

      // Send email alerts
      const emailContent = this.createLowStockAlertContent(notifications);
      let emailsSent = 0;

      for (const recipient of this.alertConfig.recipients) {
        const emailResult = await this.emailService.send(
          recipient,
          emailContent,
        );

        if (emailResult.success) {
          emailsSent++;
        }
      }

      return ok({
        lowStockCount: lowStockIngredients,
        emailsSent,
      });
    } catch (error) {
      return err(
        new Error(
          `Failed to check and alert low stock: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

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

    // Initial check
    this.checkAndAlertLowStock();
  }

  stopAutomaticAlerts(): void {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }
  }

  private createLowStockAlertContent(
    notifications: Array<{
      ingredientName: string;
      currentStock: number;
      minStock: number;
    }>,
  ) {
    const itemsList = notifications
      .map(
        (n) =>
          `• ${n.ingredientName}: Current ${n.currentStock}, Minimum ${n.minStock}`,
      )
      .join("\n");

    return {
      subject: `Low Stock Alert - ${notifications.length} Item(s) Need Attention`,
      body: `The following ingredients are running low on stock:\n\n${itemsList}\n\nPlease replenish these items as soon as possible.\n\nThis is an automated alert from the Inventory Management System.`,
      isHtml: false,
    };
  }
}
