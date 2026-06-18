"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Supplier_1 = require("../models/Supplier");
const Supplier_2 = require("../models/Supplier");
dotenv_1.default.config();
const universalIngredients = [
    {
        name: "Tomato Sauce",
        description: "Classic tomato sauce base",
        unit: "ml",
        currentStock: 5000,
        minStock: 1000,
        costPerUnit: 0.05,
        category: "Sauces",
        shelfLife: 30,
    },
    {
        name: "Mozzarella Cheese",
        description: "Fresh mozzarella cheese",
        unit: "g",
        currentStock: 10000,
        minStock: 2000,
        costPerUnit: 0.15,
        category: "Dairy",
        shelfLife: 14,
    },
    {
        name: "Basil",
        description: "Fresh basil leaves",
        unit: "g",
        currentStock: 500,
        minStock: 100,
        costPerUnit: 0.02,
        category: "Herbs",
        shelfLife: 7,
    },
    {
        name: "Pepperoni",
        description: "Spicy pepperoni slices",
        unit: "g",
        currentStock: 3000,
        minStock: 500,
        costPerUnit: 0.2,
        category: "Meat",
        shelfLife: 21,
    },
    {
        name: "Plant-based Patty",
        description: "Vegetarian patty",
        unit: "piece",
        currentStock: 50,
        minStock: 10,
        costPerUnit: 1.5,
        category: "Vegetarian",
        shelfLife: 30,
    },
    {
        name: "Lettuce",
        description: "Fresh lettuce leaves",
        unit: "g",
        currentStock: 2000,
        minStock: 500,
        costPerUnit: 0.01,
        category: "Vegetables",
        shelfLife: 5,
    },
    {
        name: "Olive Oil",
        description: "Extra virgin olive oil",
        unit: "ml",
        currentStock: 2000,
        minStock: 500,
        costPerUnit: 0.1,
        category: "Oils",
        shelfLife: 365,
    },
    {
        name: "Flour",
        description: "All-purpose flour",
        unit: "g",
        currentStock: 5000,
        minStock: 1000,
        costPerUnit: 0.02,
        category: "Baking",
        shelfLife: 180,
    },
    {
        name: "Yeast",
        description: "Active dry yeast",
        unit: "g",
        currentStock: 500,
        minStock: 100,
        costPerUnit: 0.05,
        category: "Baking",
        shelfLife: 60,
    },
    {
        name: "Garlic",
        description: "Fresh garlic cloves",
        unit: "g",
        currentStock: 1000,
        minStock: 200,
        costPerUnit: 0.01,
        category: "Vegetables",
        shelfLife: 14,
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
        if (!supplierId) {
            throw new Error("Failed to get supplier ID");
        }
        let insertedCount = 0;
        let updatedCount = 0;
        for (const ingredientData of universalIngredients) {
            const existingIngredient = await Supplier_2.Ingredient.findOne({
                name: ingredientData.name,
            });
            if (existingIngredient) {
                existingIngredient.currentStock = ingredientData.currentStock;
                existingIngredient.minStock = ingredientData.minStock;
                existingIngredient.costPerUnit = ingredientData.costPerUnit;
                existingIngredient.supplier = supplierId;
                await existingIngredient.save();
                updatedCount++;
                console.log(`↻ Updated ingredient: ${ingredientData.name}`);
            }
            else {
                await Supplier_2.Ingredient.create(Object.assign(Object.assign({}, ingredientData), { supplier: supplierId, isActive: true }));
                insertedCount++;
                console.log(`✅ Created ingredient: ${ingredientData.name}`);
            }
        }
        console.log("\n📊 Summary:");
        console.log(`Total ingredients in data: ${universalIngredients.length}`);
        console.log(`New ingredients inserted: ${insertedCount}`);
        console.log(`Existing ingredients updated: ${updatedCount}`);
        console.log("🎉 Ingredients seeded successfully!");
        const sampleIngredients = await Supplier_2.Ingredient.find({}).limit(3);
        console.log("\n📝 Sample ingredients:");
        sampleIngredients.forEach((ing) => {
            console.log(`- ${ing.name}: ${ing.currentStock}${ing.unit} (Min: ${ing.minStock}${ing.unit})`);
        });
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
//# sourceMappingURL=seed-ingredients-direct.js.map