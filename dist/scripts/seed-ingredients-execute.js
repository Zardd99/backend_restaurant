"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const dependencies_1 = require("../config/dependencies");
dotenv_1.default.config();
async function seedIngredientsWithDependencies() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant");
        console.log("Setting up dependencies...");
        (0, dependencies_1.setupDependencies)();
        const container = dependencies_1.DependencyContainer.getInstance();
        console.log("Dependencies setup complete");
        console.log("✅ Ingredient system initialized successfully");
        console.log("Automatic low stock alerts are now running");
        console.log("\nPress Ctrl+C to stop the server");
    }
    catch (error) {
        console.error("❌ Error seeding ingredients:", error);
        process.exit(1);
    }
}
seedIngredientsWithDependencies();
//# sourceMappingURL=seed-ingredients-execute.js.map