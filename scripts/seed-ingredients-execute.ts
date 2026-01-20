import mongoose from "mongoose";
import dotenv from "dotenv";
import { setupDependencies, DependencyContainer } from "../config/dependencies";

dotenv.config();

async function seedIngredientsWithDependencies() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
    );

    console.log("Setting up dependencies...");
    setupDependencies();
    const container = DependencyContainer.getInstance();

    console.log("Dependencies setup complete");

    // Optional: You can also get the IngredientRepository if you need it directly
    // const ingredientRepository = container.resolve("IngredientRepository");

    console.log("✅ Ingredient system initialized successfully");
    console.log("Automatic low stock alerts are now running");

    // Keep the process alive for testing
    console.log("\nPress Ctrl+C to stop the server");

    // For testing, you might want to exit immediately
    // process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding ingredients:", error);
    process.exit(1);
  }
}

seedIngredientsWithDependencies();
