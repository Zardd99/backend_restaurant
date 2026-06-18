"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Supplier_1 = require("../models/Supplier");
dotenv_1.default.config();
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
];
async function seedIngredientsDirect() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant");
        let supplier = await Supplier_1.Supplier.findOne({
            name: "Universal Food Supplies",
        });
        if (!supplier) {
            supplier = await Supplier_1.Supplier.create({
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
        }
        else {
            console.log("ℹ️  Using existing supplier:", supplier.name);
        }
        const supplierId = supplier._id;
        let insertedCount = 0;
        let updatedCount = 0;
        for (const ingredientData of universalIngredients) {
            const existingIngredient = await Supplier_1.Ingredient.findOne({
                name: ingredientData.name,
            });
            if (existingIngredient) {
                existingIngredient.currentStock = ingredientData.currentStock;
                existingIngredient.minStock = ingredientData.minStock;
                existingIngredient.reorderPoint = ingredientData.reorderPoint;
                existingIngredient.costPerUnit = ingredientData.costPerUnit;
                existingIngredient.supplier = supplierId;
                await existingIngredient.save();
                updatedCount++;
                console.log(`↻ Updated ingredient: ${ingredientData.name}`);
            }
            else {
                await Supplier_1.Ingredient.create(Object.assign(Object.assign({}, ingredientData), { supplier: supplierId, isActive: true }));
                insertedCount++;
                console.log(`✅ Created ingredient: ${ingredientData.name}`);
            }
        }
        console.log("\n📊 Summary:");
        console.log(`Total ingredients in data: ${universalIngredients.length}`);
        console.log(`New ingredients inserted: ${insertedCount}`);
        console.log(`Existing ingredients updated: ${updatedCount}`);
        console.log("🎉 Ingredients seeded successfully!");
        await mongoose_1.default.disconnect();
        console.log("\n✅ Disconnected from MongoDB");
    }
    catch (error) {
        console.error("❌ Error seeding ingredients:", error);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
}
seedIngredientsDirect();
//# sourceMappingURL=seed-ingredients.js.map