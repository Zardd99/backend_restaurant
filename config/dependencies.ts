import { InventoryManager } from "../application/managers/inventory-manager";
import { CheckLowStockUseCase } from "../application/use-cases/check-low-stock-use-case";
import { ConsumeIngredientsUseCase } from "../application/use-cases/consume-ingredients-use-case";
import { MongoDBIngredientRepository } from "../infrastructure/repositories/mongodb-ingredient-repository";
import { NodemailerEmailService } from "../infrastructure/services/nodemailer-email-service";
import mongoose from "mongoose";
import { Ingredient as IngredientModel } from "../models/Supplier"; // Mongoose model
import { Ingredient as DomainIngredient } from "../models/ingredient"; // Domain model (if needed)
import { IngredientRepository } from "../repositories/ingredient-repository";
import { EmailService } from "../services/email-service";

// Stub/Mock repositories for missing dependencies
import {
  MockMenuItemRepository,
  MockLowStockNotificationRepository,
} from "./stubs/mock-repositories";

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
  const ingredientRepository = new MongoDBIngredientRepository(IngredientModel);
  container.register("IngredientRepository", ingredientRepository);

  // Setup mock repositories for missing dependencies
  const menuItemRepository = new MockMenuItemRepository();
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

  // Setup manager
  const inventoryManager = new InventoryManager(
    checkLowStockUseCase,
    consumeIngredientsUseCase,
    emailService,
    lowStockNotificationRepository,
    {
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
    },
  );
  container.register("InventoryManager", inventoryManager);

  console.log("Dependencies setup complete");
  return container;
}
