import { IngredientRepository } from "../../repositories/ingredient-repository";
import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { LowStockNotificationFactory } from "../../models/low-stock-notification";
import { Result, ok, err } from "../../shared/result";

export class CheckLowStockUseCase {
  constructor(
    private ingredientRepository: IngredientRepository,
    private notificationRepository: LowStockNotificationRepository,
  ) {}

  async execute(): Promise<
    Result<{
      lowStockIngredients: number;
      notificationsCreated: number;
    }>
  > {
    try {
      // Get low stock ingredients
      const lowStockResult =
        await this.ingredientRepository.findLowStockIngredients();
      if (!lowStockResult.success) {
        return lowStockResult;
      }

      const lowStockIngredients = lowStockResult.value;
      let notificationsCreated = 0;

      // Create notifications for each low stock ingredient
      for (const ingredient of lowStockIngredients) {
        // Check if there's already an unacknowledged notification
        const existingNotification =
          await this.notificationRepository.findByIngredientId(ingredient.id);

        if (!existingNotification.success) {
          continue;
        }

        if (!existingNotification.value) {
          // Create new notification
          const notificationResult = LowStockNotificationFactory.create(
            this.generateId(),
            ingredient.id,
            ingredient.name,
            ingredient.getStock(),
            ingredient.minStock,
            err,
          );

          if (notificationResult.success) {
            const saveResult = await this.notificationRepository.create(
              notificationResult.value,
            );

            if (saveResult.success) {
              notificationsCreated++;
            }
          }
        }
      }

      return ok({
        lowStockIngredients: lowStockIngredients.length,
        notificationsCreated,
      });
    } catch (error) {
      return err(
        new Error(
          `Failed to check low stock: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
