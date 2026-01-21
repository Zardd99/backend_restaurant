import mongoose from "mongoose";
import dotenv from "dotenv";
import { Supplier, Ingredient } from "../models/Supplier";

dotenv.config();

const universalIngredients = [
  {
    name: "Tomato Sauce",
    description: "Classic tomato sauce base",
    unit: "ml",
    currentStock: 5000,
    minStock: 1000,
    reorderPoint: 1500,
    costPerUnit: 0.05,
    category: "Sauces",
    shelfLife: 30,
  },
  // ... rest of ingredients
];

async function seedIngredientsDirect() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
    );

    // Create a default supplier if it doesn't exist
    let supplier = await Supplier.findOne({
      name: "Universal Food Supplies",
    });

    if (!supplier) {
      supplier = await Supplier.create({
        name: "Universal Food Supplies",
        contactPerson: "John Doe",
        email: "supplies@universalfoods.com",
        phone: "+1-555-123-4567",
        address: {
          street: "123 Food Street",
          city: "Foodville",
          state: "CA",
          zipCode: "90210",
          country: "USA",
        },
        paymentTerms: "Net 30",
        isActive: true,
      });
      console.log("✅ Created default supplier:", supplier.name);
    } else {
      console.log("ℹ️  Using existing supplier:", supplier.name);
    }

    // Get the supplier ID - use type assertion to any to avoid type issues
    const supplierId = supplier._id as any;

    // Insert ingredients
    let insertedCount = 0;
    let updatedCount = 0;

    for (const ingredientData of universalIngredients) {
      const existingIngredient = await Ingredient.findOne({
        name: ingredientData.name,
      });

      if (existingIngredient) {
        // Update existing ingredient
        existingIngredient.currentStock = ingredientData.currentStock;
        existingIngredient.minStock = ingredientData.minStock;
        existingIngredient.reorderPoint = ingredientData.reorderPoint;
        existingIngredient.costPerUnit = ingredientData.costPerUnit;
        existingIngredient.supplier = supplierId;
        await existingIngredient.save();
        updatedCount++;
        console.log(`↻ Updated ingredient: ${ingredientData.name}`);
      } else {
        // Create new ingredient - cast supplierId to any
        await Ingredient.create({
          ...ingredientData,
          supplier: supplierId,
          isActive: true,
        } as any);
        insertedCount++;
        console.log(`✅ Created ingredient: ${ingredientData.name}`);
      }
    }

    console.log("\n📊 Summary:");
    console.log(`Total ingredients in data: ${universalIngredients.length}`);
    console.log(`New ingredients inserted: ${insertedCount}`);
    console.log(`Existing ingredients updated: ${updatedCount}`);
    console.log("🎉 Ingredients seeded successfully!");

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error seeding ingredients:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedIngredientsDirect();
