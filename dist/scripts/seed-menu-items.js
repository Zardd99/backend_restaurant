"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Supplier_1 = require("../models/Supplier");
const Supplier_2 = require("../models/Supplier");
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
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
    {
        name: "Mozzarella Cheese",
        description: "Fresh mozzarella cheese",
        unit: "g",
        currentStock: 10000,
        minStock: 2000,
        reorderPoint: 3000,
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
        reorderPoint: 150,
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
        reorderPoint: 800,
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
        reorderPoint: 15,
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
        reorderPoint: 800,
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
        reorderPoint: 800,
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
        reorderPoint: 1500,
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
        reorderPoint: 150,
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
        reorderPoint: 300,
        costPerUnit: 0.01,
        category: "Vegetables",
        shelfLife: 14,
    },
    {
        name: "Pizza Dough",
        description: "Fresh pizza dough base",
        unit: "piece",
        currentStock: 100,
        minStock: 20,
        reorderPoint: 30,
        costPerUnit: 0.8,
        category: "Baking",
        shelfLife: 2,
    },
    {
        name: "Burger Bun",
        description: "Soft burger buns",
        unit: "piece",
        currentStock: 100,
        minStock: 20,
        reorderPoint: 30,
        costPerUnit: 0.3,
        category: "Baking",
        shelfLife: 3,
    },
];
const menuItemsData = [
    {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella, and fresh basil.",
        price: 12.99,
        category: new mongoose_1.Types.ObjectId(),
        image: "images/margherita.jpg",
        ingredientReferences: [
            { ingredientName: "Pizza Dough", quantity: 1, unit: "piece" },
            { ingredientName: "Tomato Sauce", quantity: 100, unit: "ml" },
            { ingredientName: "Mozzarella Cheese", quantity: 150, unit: "g" },
            { ingredientName: "Basil", quantity: 10, unit: "g" },
            { ingredientName: "Olive Oil", quantity: 15, unit: "ml" },
        ],
        dietaryTags: ["vegetarian"],
        availability: true,
        preparationTime: 20,
        chefSpecial: true,
        averageRating: 4.7,
        reviewCount: 120,
    },
    {
        name: "Pepperoni Pizza",
        description: "Classic pizza with tomato sauce, mozzarella, and pepperoni.",
        price: 14.99,
        category: new mongoose_1.Types.ObjectId(),
        image: "images/pepperoni.jpg",
        ingredientReferences: [
            { ingredientName: "Pizza Dough", quantity: 1, unit: "piece" },
            { ingredientName: "Tomato Sauce", quantity: 100, unit: "ml" },
            { ingredientName: "Mozzarella Cheese", quantity: 150, unit: "g" },
            { ingredientName: "Pepperoni", quantity: 80, unit: "g" },
        ],
        dietaryTags: [],
        availability: true,
        preparationTime: 25,
        chefSpecial: false,
        averageRating: 4.5,
        reviewCount: 95,
    },
    {
        name: "Veggie Burger",
        description: "Plant-based burger with fresh vegetables.",
        price: 9.99,
        category: new mongoose_1.Types.ObjectId(),
        image: "images/veggie-burger.jpg",
        ingredientReferences: [
            { ingredientName: "Burger Bun", quantity: 1, unit: "piece" },
            { ingredientName: "Plant-based Patty", quantity: 1, unit: "piece" },
            { ingredientName: "Lettuce", quantity: 30, unit: "g" },
            { ingredientName: "Tomato Sauce", quantity: 20, unit: "ml" },
        ],
        dietaryTags: ["vegetarian", "vegan"],
        availability: true,
        preparationTime: 15,
        chefSpecial: false,
        averageRating: 4.3,
        reviewCount: 85,
    },
];
async function seedMenuItems() {
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
        const supplierId = supplier._id;
        const ingredientMap = new Map();
        for (const ingredientData of universalIngredients) {
            const existingIngredient = await Supplier_2.Ingredient.findOne({
                name: ingredientData.name,
            });
            if (existingIngredient) {
                existingIngredient.currentStock = ingredientData.currentStock;
                existingIngredient.minStock = ingredientData.minStock;
                existingIngredient.reorderPoint = ingredientData.reorderPoint;
                existingIngredient.costPerUnit = ingredientData.costPerUnit;
                existingIngredient.supplier = supplierId;
                await existingIngredient.save();
                ingredientMap.set(ingredientData.name, existingIngredient._id);
                console.log(`↻ Updated ingredient: ${ingredientData.name}`);
            }
            else {
                const newIngredient = await Supplier_2.Ingredient.create(Object.assign(Object.assign({}, ingredientData), { supplier: supplierId, isActive: true }));
                ingredientMap.set(ingredientData.name, newIngredient._id);
                console.log(`✅ Created ingredient: ${ingredientData.name}`);
            }
        }
        let menuItemsCreated = 0;
        let menuItemsUpdated = 0;
        for (const menuItemData of menuItemsData) {
            const existingMenuItem = await MenuItem_1.default.findOne({
                name: menuItemData.name,
            });
            const ingredientReferences = menuItemData.ingredientReferences.map((ref) => ({
                ingredient: ingredientMap.get(ref.ingredientName),
                quantity: ref.quantity,
                unit: ref.unit,
            }));
            const missingIngredients = menuItemData.ingredientReferences.filter((ref) => !ingredientMap.has(ref.ingredientName));
            if (missingIngredients.length > 0) {
                console.error(`Missing ingredients for ${menuItemData.name}:`, missingIngredients);
                continue;
            }
            if (existingMenuItem) {
                existingMenuItem.ingredientReferences = ingredientReferences;
                existingMenuItem.price = menuItemData.price;
                existingMenuItem.availability = menuItemData.availability;
                await existingMenuItem.save();
                menuItemsUpdated++;
                console.log(`↻ Updated menu item: ${menuItemData.name}`);
            }
            else {
                await MenuItem_1.default.create(Object.assign(Object.assign({}, menuItemData), { ingredientReferences }));
                menuItemsCreated++;
                console.log(`✅ Created menu item: ${menuItemData.name}`);
            }
        }
        console.log("\n📊 Summary:");
        console.log(`Ingredients seeded: ${universalIngredients.length}`);
        console.log(`Menu items created: ${menuItemsCreated}`);
        console.log(`Menu items updated: ${menuItemsUpdated}`);
        const sampleMenuItems = await MenuItem_1.default.find({})
            .limit(3)
            .populate("ingredientReferences.ingredient");
        console.log("\n💵 Sample menu item costs:");
        sampleMenuItems.forEach((item) => {
            console.log(`- ${item.name}: Price $${item.price}, Cost $${item.costPrice}, Margin ${item.profitMargin}%`);
        });
        await mongoose_1.default.disconnect();
        console.log("\n✅ Seeding completed successfully!");
    }
    catch (error) {
        console.error("❌ Error seeding data:", error);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
}
seedMenuItems();
//# sourceMappingURL=seed-menu-items.js.map