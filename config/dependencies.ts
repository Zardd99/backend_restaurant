import { InventoryManager } from "../application/managers/inventory-manager";
import { CheckLowStockUseCase } from "../application/use-cases/check-low-stock-use-case";
import { ConsumeIngredientsUseCase } from "../application/use-cases/consume-ingredients-use-case";
import { MongoDBIngredientRepository } from "../infrastructure/repositories/mongodb-ingredient-repository";
import { MongoDBMenuItemRepository } from "../infrastructure/repositories/mongodb-menu-item-repository";
import { NodemailerEmailService } from "../infrastructure/services/nodemailer-email-service";
import { MockLowStockNotificationRepository } from "../infrastructure/repositories/mock-low-stock-notification-repository";
import { Ingredient } from "../models/Supplier";
import MenuItemModel from "../models/MenuItem";

// Define interfaces locally if needed
export interface AlertConfig {
  recipients: Array<{ email: string; name?: string }>;
  checkIntervalMinutes: number;
  thresholdPercentage: number;
  enableEmailAlerts: boolean;
  enableRealTimeAlerts: boolean;
}

export class DependencyContainer {
  private static instance: DependencyContainer;
  private dependencies = new Map<string, any>();

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  register<T>(key: string, instance: T): void {
    this.dependencies.set(key, instance);
  }

  resolve<T>(key: string): T {
    const instance = this.dependencies.get(key);
    if (!instance) {
      throw new Error(`Dependency ${key} not found`);
    }
    return instance as T;
  }

  has(key: string): boolean {
    return this.dependencies.has(key);
  }

  clear(): void {
    this.dependencies.clear();
  }
}

export function setupDependencies(): DependencyContainer {
  const container = DependencyContainer.getInstance();

  // Setup repositories
  const ingredientRepository = new MongoDBIngredientRepository(Ingredient);
  container.register("IngredientRepository", ingredientRepository);

  const menuItemRepository = new MongoDBMenuItemRepository(MenuItemModel);
  container.register("MenuItemRepository", menuItemRepository);

  const lowStockNotificationRepository =
    new MockLowStockNotificationRepository();
  container.register(
    "LowStockNotificationRepository",
    lowStockNotificationRepository,
  );

  // Setup email service
  const emailService = new NodemailerEmailService({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    from: process.env.SMTP_FROM || "inventory@restaurant.com",
  });
  container.register("EmailService", emailService);

  // Setup use cases
  const checkLowStockUseCase = new CheckLowStockUseCase(
    ingredientRepository,
    lowStockNotificationRepository,
  );
  container.register("CheckLowStockUseCase", checkLowStockUseCase);

  const consumeIngredientsUseCase = new ConsumeIngredientsUseCase(
    menuItemRepository,
    ingredientRepository,
  );
  container.register("ConsumeIngredientsUseCase", consumeIngredientsUseCase);

  // Setup manager with proper AlertConfig
  const alertConfig: AlertConfig = {
    recipients: [
      {
        email: process.env.ADMIN_EMAIL || "admin@restaurant.com",
        name: "Restaurant Manager",
      },
      {
        email: process.env.MANAGER_EMAIL || "manager@restaurant.com",
        name: "Inventory Manager",
      },
    ],
    checkIntervalMinutes: parseInt(process.env.ALERT_INTERVAL || "60"),
    thresholdPercentage: 0.2,
    enableEmailAlerts: process.env.ENABLE_EMAIL_ALERTS === "true",
    enableRealTimeAlerts: process.env.ENABLE_REAL_TIME_ALERTS === "true",
  };

  const inventoryManager = new InventoryManager(
    checkLowStockUseCase,
    consumeIngredientsUseCase,
    emailService,
    lowStockNotificationRepository,
    ingredientRepository,
    alertConfig,
  );

  container.register("InventoryManager", inventoryManager);

  console.log("✅ Dependencies setup complete");
  return container;
}
