import { MenuItemRepository } from "../../repositories/menu-item-repository";
import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { MenuItem } from "../../models/ingredient";
import { LowStockNotification } from "../../models/low-stock-notification";
import { Result, ok, err } from "../../shared/result";

export class MockMenuItemRepository implements MenuItemRepository {
  private mockData: MenuItem[] = [];

  async findById(id: string): Promise<Result<MenuItem | null>> {
    const item = this.mockData.find((item) => item.id === id);
    return ok(item || null);
  }

  async findAllActive(): Promise<Result<MenuItem[]>> {
    return ok(this.mockData.filter((item) => item.isActive));
  }

  async findByIds(ids: string[]): Promise<Result<MenuItem[]>> {
    const items = this.mockData.filter((item) => ids.includes(item.id));
    return ok(items);
  }

  async save(menuItem: MenuItem): Promise<Result<MenuItem>> {
    const index = this.mockData.findIndex((item) => item.id === menuItem.id);
    if (index >= 0) {
      this.mockData[index] = menuItem;
    } else {
      this.mockData.push(menuItem);
    }
    return ok(menuItem);
  }

  // Helper method to add mock data
  addMockData(items: MenuItem[]): void {
    this.mockData.push(...items);
  }
}

export class MockLowStockNotificationRepository implements LowStockNotificationRepository {
  private notifications: LowStockNotification[] = [];

  async create(
    notification: LowStockNotification,
  ): Promise<Result<LowStockNotification>> {
    this.notifications.push(notification);
    return ok(notification);
  }

  async findUnacknowledged(): Promise<Result<LowStockNotification[]>> {
    const unacknowledged = this.notifications.filter((n) => !n.acknowledged);
    return ok(unacknowledged);
  }

  async acknowledge(
    id: string,
    userId: string,
  ): Promise<Result<LowStockNotification>> {
    const notification = this.notifications.find((n) => n.id === id);
    if (!notification) {
      return err(new Error("Notification not found"));
    }

    const updatedNotification = {
      ...notification,
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    };

    const index = this.notifications.findIndex((n) => n.id === id);
    this.notifications[index] = updatedNotification;

    return ok(updatedNotification);
  }

  async findByIngredientId(
    ingredientId: string,
  ): Promise<Result<LowStockNotification | null>> {
    const notification = this.notifications.find(
      (n) => n.ingredientId === ingredientId && !n.acknowledged,
    );
    return ok(notification || null);
  }
}
