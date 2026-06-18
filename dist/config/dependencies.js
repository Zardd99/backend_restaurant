"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyContainer = void 0;
exports.setupDependencies = setupDependencies;
const inventory_manager_1 = require("../application/managers/inventory-manager");
const check_low_stock_use_case_1 = require("../application/use-cases/check-low-stock-use-case");
const consume_ingredients_use_case_1 = require("../application/use-cases/consume-ingredients-use-case");
const mongodb_ingredient_repository_1 = require("../infrastructure/repositories/mongodb-ingredient-repository");
const mongodb_menu_item_repository_1 = require("../infrastructure/repositories/mongodb-menu-item-repository");
const nodemailer_email_service_1 = require("../infrastructure/services/nodemailer-email-service");
const mock_low_stock_notification_repository_1 = require("../infrastructure/repositories/mock-low-stock-notification-repository");
const Supplier_1 = require("../models/Supplier");
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
class DependencyContainer {
    constructor() {
        this.dependencies = new Map();
    }
    static getInstance() {
        if (!DependencyContainer.instance) {
            DependencyContainer.instance = new DependencyContainer();
        }
        return DependencyContainer.instance;
    }
    register(key, instance) {
        this.dependencies.set(key, instance);
    }
    resolve(key) {
        const instance = this.dependencies.get(key);
        if (!instance) {
            throw new Error(`Dependency ${key} not found`);
        }
        return instance;
    }
    has(key) {
        return this.dependencies.has(key);
    }
    clear() {
        this.dependencies.clear();
    }
}
exports.DependencyContainer = DependencyContainer;
function setupDependencies() {
    const container = DependencyContainer.getInstance();
    const ingredientRepository = new mongodb_ingredient_repository_1.MongoDBIngredientRepository(Supplier_1.Ingredient);
    container.register("IngredientRepository", ingredientRepository);
    const menuItemRepository = new mongodb_menu_item_repository_1.MongoDBMenuItemRepository(MenuItem_1.default);
    container.register("MenuItemRepository", menuItemRepository);
    const lowStockNotificationRepository = new mock_low_stock_notification_repository_1.MockLowStockNotificationRepository();
    container.register("LowStockNotificationRepository", lowStockNotificationRepository);
    const emailService = new nodemailer_email_service_1.NodemailerEmailService({
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
    const checkLowStockUseCase = new check_low_stock_use_case_1.CheckLowStockUseCase(ingredientRepository, lowStockNotificationRepository);
    container.register("CheckLowStockUseCase", checkLowStockUseCase);
    const consumeIngredientsUseCase = new consume_ingredients_use_case_1.ConsumeIngredientsUseCase(menuItemRepository, ingredientRepository);
    container.register("ConsumeIngredientsUseCase", consumeIngredientsUseCase);
    const alertConfig = {
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
    const inventoryManager = new inventory_manager_1.InventoryManager(checkLowStockUseCase, consumeIngredientsUseCase, emailService, lowStockNotificationRepository, ingredientRepository, alertConfig);
    container.register("InventoryManager", inventoryManager);
    console.log("Application dependency graph initialized successfully");
    return container;
}
//# sourceMappingURL=dependencies.js.map