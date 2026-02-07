import { InventoryManager } from "../application/managers/inventory-manager";
import { CheckLowStockUseCase } from "../application/use-cases/check-low-stock-use-case";
import { ConsumeIngredientsUseCase } from "../application/use-cases/consume-ingredients-use-case";
import { MongoDBIngredientRepository } from "../infrastructure/repositories/mongodb-ingredient-repository";
import { MongoDBMenuItemRepository } from "../infrastructure/repositories/mongodb-menu-item-repository";
import { NodemailerEmailService } from "../infrastructure/services/nodemailer-email-service";
import { MockLowStockNotificationRepository } from "../infrastructure/repositories/mock-low-stock-notification-repository";
import { Ingredient } from "../models/Supplier";
import MenuItemModel from "../models/MenuItem";

export interface AlertConfig {
  recipients: Array<{ email: string; name?: string }>;
  checkIntervalMinutes: number;
  thresholdPercentage: number;
  enableEmailAlerts: boolean;
  enableRealTimeAlerts: boolean;
}

/**
 * DependencyContainer (Inversion of Control Container)
 * * Purpose: Manages the lifecycle and resolution of application services.
 * * Pattern: Singleton.
 * * Using a DI container allows for easier unit testing by swapping
 * real implementations (e.g., MongoDB) with mocks.
 */
export class DependencyContainer {
  private static instance: DependencyContainer;
  // Internal registry for dependency instances
  private dependencies = new Map<string, any>();

  private constructor() {}

  /**
   * Retrieves the global instance of the container.
   */
  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  /**
   * Binds an implementation to a specific key.
   */
  register<T>(key: string, instance: T): void {
    this.dependencies.set(key, instance);
  }

  /**
   * Resolves and returns a dependency.
   * @throws Error if the key is not registered.
   */
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

/**
 * setupDependencies
 * * The Application's Bootstrap Function.
 * This is where we define which concrete implementations the application uses.
 */
export function setupDependencies(): DependencyContainer {
  const container = DependencyContainer.getInstance();

  // --- Phase 1: Infrastructure & Repositories ---
  // These provide the data access layer for the application.
  const ingredientRepository = new MongoDBIngredientRepository(Ingredient);
  container.register("IngredientRepository", ingredientRepository);

  const menuItemRepository = new MongoDBMenuItemRepository(MenuItemModel);
  container.register("MenuItemRepository", menuItemRepository);

  // NOTE: Currently using a Mock repository for notifications.
  // TODO: Replace with MongoDBLowStockNotificationRepository for production persistence.
  const lowStockNotificationRepository =
    new MockLowStockNotificationRepository();
  container.register(
    "LowStockNotificationRepository",
    lowStockNotificationRepository,
  );

  // --- Phase 2: External Services ---
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

  // --- Phase 3: Domain Use Cases ---
  // We inject the repositories created in Phase 1 into our business logic.
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

  // --- Phase 4: Application Managers ---
  // High-level orchestrators that require multiple use cases and services.
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
    thresholdPercentage: 0.2, // Safety buffer before triggering alerts
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

  console.log("✅ Application dependency graph initialized successfully");
  return container;
}
