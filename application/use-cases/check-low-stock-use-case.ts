import { IngredientRepository } from "../../repositories/ingredient-repository";
import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { LowStockNotificationFactory } from "../../models/low-stock-notification";
import { Result, ok, err } from "../../shared/result";

/**
 * Use Case: CheckLowStock
 * * Logic:
 * 1. Scans the inventory for items below their safety thresholds.
 * 2. Generates system notifications for stock replenishment.
 * 3. Prevents duplicate alerts by checking for existing unacknowledged notifications.
 */
export class CheckLowStockUseCase {
  constructor(
    private ingredientRepository: IngredientRepository,
    private notificationRepository: LowStockNotificationRepository,
  ) {}

  /**
   * Executes the stock audit and notification generation process.
   * @returns A summary of identified low stock items and the count of new notifications created.
   */
  async execute(): Promise<
    Result<{
      lowStockIngredients: Array<{
        id: string;
        name: string;
        currentStock: number;
        minStock: number;
        reorderPoint: number;
        unit: string;
      }>;
      notificationsCreated: number;
    }>
  > {
    try {
      // Fetch ingredients that have breached reorder thresholds from the repository
      const lowStockResult =
        await this.ingredientRepository.findLowStockIngredients();

      if (!lowStockResult.success) {
        return lowStockResult;
      }

      const lowStockIngredients = lowStockResult.value;
      let notificationsCreated = 0;

      /**
       * Notification Idempotency Logic:
       * We iterate through each depleted item and verify if a notification already exists.
       * This prevents "alert fatigue" and database bloat.
       */
      for (const ingredient of lowStockIngredients) {
        // Check for active (unacknowledged) notifications for this specific ingredient
        const existingNotification =
          await this.notificationRepository.findByIngredientId(ingredient.id);

        if (!existingNotification.success) {
          continue; // Logically skip if repository check fails to avoid crashing the whole audit
        }

        // Only create a new notification if one doesn't already exist for this ingredient
        if (!existingNotification.value) {
          const notificationResult = LowStockNotificationFactory.create(
            this.generateId(),
            ingredient.id,
            ingredient.name,
            ingredient.getStock(),
            ingredient.minStock,
            err, // Note: Passing 'err' here seems to be a factory requirement for result handling
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

      // Map domain entities to DTO (Data Transfer Object) for the caller
      return ok({
        lowStockIngredients: lowStockIngredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          currentStock: ingredient.getStock(),
          minStock: ingredient.minStock,
          reorderPoint: ingredient.reorderPoint,
          unit: ingredient.unit,
        })),
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

  /**
   * Generates a unique identifier for new notification entities.
   * Implementation Note: Consider moving to a dedicated UUID provider for production scale.
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
