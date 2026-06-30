/**
 * IMS inventory catalog seed.
 *
 * Seeds the FULL raw-ingredient master needed to cover every dish in the menu
 * catalog (see scripts/seed-menu-catalog.ts), plus a set of in-house "prepped"
 * ingredients with their recipes (BOM) so the prep-run flow is exercisable.
 *
 * Idempotent: ingredients/prepped items are upserted by name and recipes by
 * (targetId, targetType), so re-running only refreshes stock/cost values.
 *
 *   npx ts-node scripts/seed-inventory-catalog.ts
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { Supplier, Ingredient, StorageRequirement } from "../models/Supplier";
import Recipe from "../models/Recipe";

dotenv.config();

type Category =
  | "Produce"
  | "Meat"
  | "Seafood"
  | "Dairy"
  | "Bakery"
  | "Dry Goods"
  | "Baking"
  | "Sauces"
  | "Oils"
  | "Herbs & Spices"
  | "Beverages"
  | "Frozen"
  | "Prepped";

interface SeedIngredient {
  name: string;
  description: string;
  unit: "g" | "ml" | "piece";
  category: Category;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  shelfLife: number; // days
  storage?: StorageRequirement;
}

// Storage defaults by category; overridden per-item via `storage`.
const STORAGE_BY_CATEGORY: Record<Category, StorageRequirement> = {
  Produce: "chilled",
  Meat: "chilled",
  Seafood: "chilled",
  Dairy: "chilled",
  Bakery: "ambient",
  "Dry Goods": "ambient",
  Baking: "ambient",
  Sauces: "chilled",
  Oils: "ambient",
  "Herbs & Spices": "ambient",
  Beverages: "ambient",
  Frozen: "frozen",
  Prepped: "chilled",
};

// Comprehensive raw-ingredient master covering all menu categories:
// pizza, salads, burgers/sandwiches, soups, appetizers, mains, breakfast,
// desserts, and beverages.
const RAW_INGREDIENTS: SeedIngredient[] = [
  // --- Produce ---
  { name: "Tomato", description: "Fresh ripe tomatoes", unit: "g", category: "Produce", currentStock: 8000, minStock: 1500, costPerUnit: 0.004, shelfLife: 10 },
  { name: "Onion", description: "Yellow onions", unit: "g", category: "Produce", currentStock: 9000, minStock: 1500, costPerUnit: 0.002, shelfLife: 30 },
  { name: "Garlic", description: "Fresh garlic cloves", unit: "g", category: "Produce", currentStock: 1500, minStock: 300, costPerUnit: 0.01, shelfLife: 21 },
  { name: "Celery", description: "Celery stalks", unit: "g", category: "Produce", currentStock: 3000, minStock: 600, costPerUnit: 0.003, shelfLife: 14 },
  { name: "Carrot", description: "Carrots", unit: "g", category: "Produce", currentStock: 5000, minStock: 1000, costPerUnit: 0.003, shelfLife: 21 },
  { name: "Lettuce", description: "Romaine/iceberg lettuce", unit: "g", category: "Produce", currentStock: 4000, minStock: 800, costPerUnit: 0.006, shelfLife: 7 },
  { name: "Cucumber", description: "Cucumbers", unit: "g", category: "Produce", currentStock: 3000, minStock: 600, costPerUnit: 0.004, shelfLife: 10 },
  { name: "Bell Pepper", description: "Assorted bell peppers", unit: "g", category: "Produce", currentStock: 3000, minStock: 600, costPerUnit: 0.006, shelfLife: 12 },
  { name: "Avocado", description: "Hass avocados", unit: "piece", category: "Produce", currentStock: 200, minStock: 40, costPerUnit: 0.9, shelfLife: 7 },
  { name: "Potato", description: "Russet potatoes", unit: "g", category: "Produce", currentStock: 12000, minStock: 2500, costPerUnit: 0.0015, shelfLife: 30 },
  { name: "Lemon", description: "Fresh lemons", unit: "piece", category: "Produce", currentStock: 300, minStock: 60, costPerUnit: 0.4, shelfLife: 21 },
  { name: "Lime", description: "Fresh limes", unit: "piece", category: "Produce", currentStock: 300, minStock: 60, costPerUnit: 0.35, shelfLife: 21 },
  { name: "Orange", description: "Juicing oranges", unit: "piece", category: "Produce", currentStock: 400, minStock: 80, costPerUnit: 0.5, shelfLife: 21 },
  { name: "Mango", description: "Ripe mango", unit: "g", category: "Produce", currentStock: 3000, minStock: 600, costPerUnit: 0.005, shelfLife: 8 },
  { name: "Banana", description: "Bananas", unit: "piece", category: "Produce", currentStock: 200, minStock: 40, costPerUnit: 0.25, shelfLife: 7 },
  { name: "Apple", description: "Baking apples", unit: "g", category: "Produce", currentStock: 5000, minStock: 1000, costPerUnit: 0.004, shelfLife: 30 },
  { name: "Mixed Berries", description: "Strawberry/blueberry mix", unit: "g", category: "Produce", currentStock: 2500, minStock: 500, costPerUnit: 0.012, shelfLife: 6 },
  { name: "Blueberry", description: "Fresh blueberries", unit: "g", category: "Produce", currentStock: 2000, minStock: 400, costPerUnit: 0.015, shelfLife: 7 },
  { name: "Pineapple", description: "Pineapple chunks", unit: "g", category: "Produce", currentStock: 2500, minStock: 500, costPerUnit: 0.005, shelfLife: 8 },
  { name: "Mushroom", description: "Button mushrooms", unit: "g", category: "Produce", currentStock: 2500, minStock: 500, costPerUnit: 0.008, shelfLife: 7 },
  { name: "Cilantro", description: "Fresh cilantro", unit: "g", category: "Produce", currentStock: 400, minStock: 80, costPerUnit: 0.02, shelfLife: 6 },
  { name: "Ginger", description: "Fresh ginger root", unit: "g", category: "Produce", currentStock: 800, minStock: 150, costPerUnit: 0.012, shelfLife: 21 },
  { name: "Chickpeas", description: "Cooked chickpeas", unit: "g", category: "Produce", currentStock: 4000, minStock: 800, costPerUnit: 0.004, shelfLife: 14 },
  { name: "Olives", description: "Kalamata olives", unit: "g", category: "Produce", currentStock: 2000, minStock: 400, costPerUnit: 0.01, shelfLife: 60 },

  // --- Meat ---
  { name: "Ground Beef", description: "80/20 ground beef", unit: "g", category: "Meat", currentStock: 10000, minStock: 2000, costPerUnit: 0.012, shelfLife: 4 },
  { name: "Beef Steak", description: "Ribeye/sirloin steak", unit: "g", category: "Meat", currentStock: 8000, minStock: 1500, costPerUnit: 0.025, shelfLife: 5 },
  { name: "Beef Bones", description: "Marrow bones for stock", unit: "g", category: "Meat", currentStock: 12000, minStock: 2000, costPerUnit: 0.004, shelfLife: 6 },
  { name: "Bison Patty", description: "Ground bison patty", unit: "piece", category: "Meat", currentStock: 120, minStock: 30, costPerUnit: 2.2, shelfLife: 5 },
  { name: "Chicken Breast", description: "Boneless chicken breast", unit: "g", category: "Meat", currentStock: 12000, minStock: 2500, costPerUnit: 0.009, shelfLife: 4 },
  { name: "Chicken Wings", description: "Party wings", unit: "g", category: "Meat", currentStock: 8000, minStock: 1500, costPerUnit: 0.008, shelfLife: 4 },
  { name: "Bacon", description: "Smoked bacon", unit: "g", category: "Meat", currentStock: 4000, minStock: 800, costPerUnit: 0.014, shelfLife: 14 },
  { name: "Ham", description: "Smoked sliced ham", unit: "g", category: "Meat", currentStock: 4000, minStock: 800, costPerUnit: 0.012, shelfLife: 14 },
  { name: "Pepperoni", description: "Spicy pepperoni slices", unit: "g", category: "Meat", currentStock: 4000, minStock: 700, costPerUnit: 0.018, shelfLife: 30 },

  // --- Seafood ---
  { name: "White Fish Fillet", description: "Cod/tilapia fillet", unit: "g", category: "Seafood", currentStock: 6000, minStock: 1200, costPerUnit: 0.016, shelfLife: 3, storage: "frozen" },

  // --- Dairy ---
  { name: "Mozzarella Cheese", description: "Shredded mozzarella", unit: "g", category: "Dairy", currentStock: 12000, minStock: 2500, costPerUnit: 0.012, shelfLife: 14 },
  { name: "Cheddar Cheese", description: "Aged cheddar", unit: "g", category: "Dairy", currentStock: 8000, minStock: 1500, costPerUnit: 0.013, shelfLife: 21 },
  { name: "Parmesan Cheese", description: "Grated parmesan", unit: "g", category: "Dairy", currentStock: 5000, minStock: 1000, costPerUnit: 0.02, shelfLife: 30 },
  { name: "Feta Cheese", description: "Crumbled feta", unit: "g", category: "Dairy", currentStock: 3000, minStock: 600, costPerUnit: 0.016, shelfLife: 21 },
  { name: "Gorgonzola Cheese", description: "Blue gorgonzola", unit: "g", category: "Dairy", currentStock: 2000, minStock: 400, costPerUnit: 0.024, shelfLife: 21 },
  { name: "Fontina Cheese", description: "Fontina", unit: "g", category: "Dairy", currentStock: 2000, minStock: 400, costPerUnit: 0.022, shelfLife: 21 },
  { name: "Mascarpone", description: "Mascarpone cheese", unit: "g", category: "Dairy", currentStock: 2500, minStock: 500, costPerUnit: 0.018, shelfLife: 14 },
  { name: "Cream Cheese", description: "Cream cheese", unit: "g", category: "Dairy", currentStock: 4000, minStock: 800, costPerUnit: 0.01, shelfLife: 21 },
  { name: "Butter", description: "Unsalted butter", unit: "g", category: "Dairy", currentStock: 6000, minStock: 1200, costPerUnit: 0.009, shelfLife: 30 },
  { name: "Milk", description: "Whole milk", unit: "ml", category: "Dairy", currentStock: 15000, minStock: 3000, costPerUnit: 0.001, shelfLife: 10 },
  { name: "Heavy Cream", description: "Heavy whipping cream", unit: "ml", category: "Dairy", currentStock: 6000, minStock: 1200, costPerUnit: 0.004, shelfLife: 14 },
  { name: "Greek Yogurt", description: "Plain Greek yogurt", unit: "g", category: "Dairy", currentStock: 5000, minStock: 1000, costPerUnit: 0.006, shelfLife: 14 },
  { name: "Egg", description: "Large eggs", unit: "piece", category: "Dairy", currentStock: 600, minStock: 120, costPerUnit: 0.18, shelfLife: 21 },

  // --- Bakery ---
  { name: "Burger Bun", description: "Brioche burger buns", unit: "piece", category: "Bakery", currentStock: 400, minStock: 80, costPerUnit: 0.4, shelfLife: 5 },
  { name: "Sandwich Bread", description: "Sliced sourdough", unit: "piece", category: "Bakery", currentStock: 500, minStock: 100, costPerUnit: 0.25, shelfLife: 6 },
  { name: "Ciabatta", description: "Ciabatta loaf", unit: "piece", category: "Bakery", currentStock: 200, minStock: 40, costPerUnit: 0.8, shelfLife: 5 },
  { name: "Tortilla", description: "Flour tortillas", unit: "piece", category: "Bakery", currentStock: 500, minStock: 100, costPerUnit: 0.2, shelfLife: 14 },
  { name: "Taco Shell", description: "Corn taco shells", unit: "piece", category: "Bakery", currentStock: 500, minStock: 100, costPerUnit: 0.18, shelfLife: 30 },
  { name: "Tortilla Chips", description: "Corn tortilla chips", unit: "g", category: "Bakery", currentStock: 6000, minStock: 1200, costPerUnit: 0.005, shelfLife: 45 },
  { name: "Ladyfingers", description: "Savoiardi biscuits", unit: "g", category: "Bakery", currentStock: 2000, minStock: 400, costPerUnit: 0.012, shelfLife: 60 },
  { name: "Graham Crackers", description: "Graham cracker crumbs", unit: "g", category: "Bakery", currentStock: 2000, minStock: 400, costPerUnit: 0.008, shelfLife: 90 },

  // --- Dry Goods ---
  { name: "Pizza Flour", description: "00 pizza flour", unit: "g", category: "Dry Goods", currentStock: 20000, minStock: 4000, costPerUnit: 0.002, shelfLife: 180 },
  { name: "Rice", description: "Long-grain white rice", unit: "g", category: "Dry Goods", currentStock: 15000, minStock: 3000, costPerUnit: 0.002, shelfLife: 365 },
  { name: "Rice Noodles", description: "Flat rice noodles (pho)", unit: "g", category: "Dry Goods", currentStock: 6000, minStock: 1200, costPerUnit: 0.004, shelfLife: 365 },
  { name: "Egg Noodles", description: "Dried egg noodles", unit: "g", category: "Dry Goods", currentStock: 6000, minStock: 1200, costPerUnit: 0.004, shelfLife: 365 },
  { name: "Pasta", description: "Small soup pasta", unit: "g", category: "Dry Goods", currentStock: 6000, minStock: 1200, costPerUnit: 0.003, shelfLife: 365 },
  { name: "Spring Roll Wrapper", description: "Spring roll wrappers", unit: "piece", category: "Dry Goods", currentStock: 600, minStock: 120, costPerUnit: 0.08, shelfLife: 120 },
  { name: "Panko Breadcrumbs", description: "Panko crumbs", unit: "g", category: "Dry Goods", currentStock: 5000, minStock: 1000, costPerUnit: 0.004, shelfLife: 120 },
  { name: "Cannellini Beans", description: "White beans", unit: "g", category: "Dry Goods", currentStock: 4000, minStock: 800, costPerUnit: 0.004, shelfLife: 365 },
  { name: "Coffee Beans", description: "Espresso roast beans", unit: "g", category: "Dry Goods", currentStock: 5000, minStock: 1000, costPerUnit: 0.02, shelfLife: 180 },
  { name: "Tea Leaves", description: "Black tea", unit: "g", category: "Dry Goods", currentStock: 2000, minStock: 400, costPerUnit: 0.015, shelfLife: 365 },

  // --- Baking ---
  { name: "All-Purpose Flour", description: "All-purpose flour", unit: "g", category: "Baking", currentStock: 20000, minStock: 4000, costPerUnit: 0.0015, shelfLife: 180 },
  { name: "Sugar", description: "Granulated sugar", unit: "g", category: "Baking", currentStock: 15000, minStock: 3000, costPerUnit: 0.0012, shelfLife: 720 },
  { name: "Brown Sugar", description: "Light brown sugar", unit: "g", category: "Baking", currentStock: 8000, minStock: 1500, costPerUnit: 0.0015, shelfLife: 540 },
  { name: "Cocoa Powder", description: "Dutch cocoa", unit: "g", category: "Baking", currentStock: 3000, minStock: 600, costPerUnit: 0.01, shelfLife: 365 },
  { name: "Dark Chocolate", description: "Couverture dark chocolate", unit: "g", category: "Baking", currentStock: 4000, minStock: 800, costPerUnit: 0.018, shelfLife: 365 },
  { name: "Chocolate Chips", description: "Semi-sweet chips", unit: "g", category: "Baking", currentStock: 4000, minStock: 800, costPerUnit: 0.012, shelfLife: 365 },
  { name: "Yeast", description: "Active dry yeast", unit: "g", category: "Baking", currentStock: 800, minStock: 150, costPerUnit: 0.05, shelfLife: 365 },
  { name: "Baking Powder", description: "Baking powder", unit: "g", category: "Baking", currentStock: 1500, minStock: 300, costPerUnit: 0.006, shelfLife: 365 },
  { name: "Vanilla Extract", description: "Pure vanilla extract", unit: "ml", category: "Baking", currentStock: 1000, minStock: 200, costPerUnit: 0.06, shelfLife: 730 },
  { name: "Honey", description: "Wildflower honey", unit: "ml", category: "Baking", currentStock: 3000, minStock: 600, costPerUnit: 0.01, shelfLife: 720 },

  // --- Sauces ---
  { name: "Tomato Paste", description: "Concentrated tomato paste", unit: "g", category: "Sauces", currentStock: 6000, minStock: 1200, costPerUnit: 0.006, shelfLife: 180, storage: "ambient" },
  { name: "BBQ Sauce", description: "Smoky BBQ sauce", unit: "ml", category: "Sauces", currentStock: 4000, minStock: 800, costPerUnit: 0.006, shelfLife: 180, storage: "ambient" },
  { name: "Buffalo Sauce", description: "Hot buffalo sauce", unit: "ml", category: "Sauces", currentStock: 3000, minStock: 600, costPerUnit: 0.006, shelfLife: 180, storage: "ambient" },
  { name: "Mayonnaise", description: "Mayonnaise", unit: "ml", category: "Sauces", currentStock: 5000, minStock: 1000, costPerUnit: 0.004, shelfLife: 60 },
  { name: "Soy Sauce", description: "Soy sauce", unit: "ml", category: "Sauces", currentStock: 3000, minStock: 600, costPerUnit: 0.004, shelfLife: 365, storage: "ambient" },
  { name: "Sweet Chili Sauce", description: "Sweet chili dip", unit: "ml", category: "Sauces", currentStock: 2000, minStock: 400, costPerUnit: 0.006, shelfLife: 180, storage: "ambient" },
  { name: "Tikka Masala Sauce", description: "Tikka masala simmer sauce", unit: "ml", category: "Sauces", currentStock: 4000, minStock: 800, costPerUnit: 0.008, shelfLife: 120 },

  // --- Oils ---
  { name: "Olive Oil", description: "Extra virgin olive oil", unit: "ml", category: "Oils", currentStock: 5000, minStock: 1000, costPerUnit: 0.008, shelfLife: 365 },
  { name: "Vegetable Oil", description: "Frying oil", unit: "ml", category: "Oils", currentStock: 15000, minStock: 3000, costPerUnit: 0.003, shelfLife: 365 },

  // --- Herbs & Spices ---
  { name: "Basil", description: "Fresh basil leaves", unit: "g", category: "Herbs & Spices", currentStock: 800, minStock: 150, costPerUnit: 0.02, shelfLife: 7, storage: "chilled" },
  { name: "Parsley", description: "Fresh parsley", unit: "g", category: "Herbs & Spices", currentStock: 800, minStock: 150, costPerUnit: 0.018, shelfLife: 7, storage: "chilled" },
  { name: "Oregano", description: "Dried oregano", unit: "g", category: "Herbs & Spices", currentStock: 600, minStock: 120, costPerUnit: 0.02, shelfLife: 365 },
  { name: "Salt", description: "Kosher salt", unit: "g", category: "Herbs & Spices", currentStock: 10000, minStock: 2000, costPerUnit: 0.0005, shelfLife: 1080 },
  { name: "Black Pepper", description: "Ground black pepper", unit: "g", category: "Herbs & Spices", currentStock: 2000, minStock: 400, costPerUnit: 0.02, shelfLife: 540 },
  { name: "Cumin", description: "Ground cumin", unit: "g", category: "Herbs & Spices", currentStock: 1500, minStock: 300, costPerUnit: 0.018, shelfLife: 540 },
  { name: "Paprika", description: "Smoked paprika", unit: "g", category: "Herbs & Spices", currentStock: 1500, minStock: 300, costPerUnit: 0.016, shelfLife: 540 },
  { name: "Cinnamon", description: "Ground cinnamon", unit: "g", category: "Herbs & Spices", currentStock: 1500, minStock: 300, costPerUnit: 0.015, shelfLife: 540 },

  // --- Beverages ---
  { name: "Sparkling Water", description: "Carbonated water", unit: "ml", category: "Beverages", currentStock: 20000, minStock: 4000, costPerUnit: 0.001, shelfLife: 365 },
  { name: "Coconut Milk", description: "Coconut milk", unit: "ml", category: "Beverages", currentStock: 5000, minStock: 1000, costPerUnit: 0.003, shelfLife: 180 },

  // --- Frozen ---
  { name: "Vanilla Ice Cream", description: "Vanilla ice cream base", unit: "ml", category: "Frozen", currentStock: 8000, minStock: 1500, costPerUnit: 0.006, shelfLife: 180 },
  { name: "Plant-based Patty", description: "Vegetarian patty", unit: "piece", category: "Frozen", currentStock: 120, minStock: 30, costPerUnit: 1.5, shelfLife: 180 },
];

// In-house prepped ingredients + their recipes. Recipe component quantities are
// expressed PER 1 UNIT of output (the prep use case multiplies by the run size).
interface PreppedSeed {
  ingredient: Omit<SeedIngredient, "category"> & { category: "Prepped" };
  // [rawIngredientName, grossQuantity, netQuantity, unit]
  recipe: Array<[string, number, number, "g" | "ml" | "piece"]>;
}

const PREPPED_INGREDIENTS: PreppedSeed[] = [
  {
    ingredient: { name: "House Beef Stock", description: "Slow-simmered beef bone stock", unit: "ml", category: "Prepped", currentStock: 0, minStock: 2000, costPerUnit: 0.006, shelfLife: 5, storage: "chilled" },
    // ~10kg bones + aromatics -> ~8 L stock => per ml of output:
    recipe: [
      ["Beef Bones", 1.25, 1.0, "g"],
      ["Onion", 0.0625, 0.05, "g"],
      ["Celery", 0.0375, 0.03, "g"],
      ["Carrot", 0.0375, 0.03, "g"],
    ],
  },
  {
    ingredient: { name: "House Marinara Sauce", description: "Tomato, garlic, basil marinara", unit: "ml", category: "Prepped", currentStock: 0, minStock: 2000, costPerUnit: 0.01, shelfLife: 7, storage: "chilled" },
    recipe: [
      ["Tomato Paste", 0.5, 0.48, "g"],
      ["Garlic", 0.02, 0.018, "g"],
      ["Olive Oil", 0.05, 0.05, "ml"],
      ["Basil", 0.01, 0.009, "g"],
    ],
  },
  {
    ingredient: { name: "Pizza Dough", description: "Proofed Neapolitan pizza dough", unit: "g", category: "Prepped", currentStock: 0, minStock: 3000, costPerUnit: 0.004, shelfLife: 3, storage: "chilled" },
    recipe: [
      ["Pizza Flour", 0.62, 0.6, "g"],
      ["Yeast", 0.004, 0.004, "g"],
      ["Olive Oil", 0.02, 0.02, "ml"],
      ["Salt", 0.012, 0.012, "g"],
    ],
  },
  {
    ingredient: { name: "Caesar Dressing", description: "Creamy parmesan caesar dressing", unit: "ml", category: "Prepped", currentStock: 0, minStock: 1000, costPerUnit: 0.012, shelfLife: 10, storage: "chilled" },
    recipe: [
      ["Mayonnaise", 0.7, 0.7, "ml"],
      ["Parmesan Cheese", 0.1, 0.095, "g"],
      ["Garlic", 0.02, 0.018, "g"],
      ["Olive Oil", 0.1, 0.1, "ml"],
    ],
  },
];

async function run(): Promise<void> {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
  );
  console.log("Connected.");

  const supplier = await Supplier.findOneAndUpdate(
    { name: "IMS Primary Distributor" },
    {
      $setOnInsert: {
        name: "IMS Primary Distributor",
        contactPerson: "Procurement Desk",
        email: "orders@ims-distributor.com",
        phone: "+1-555-0100",
        address: {
          street: "1 Supply Chain Way",
          city: "Foodville",
          state: "CA",
          zipCode: "90210",
          country: "USA",
        },
        paymentTerms: "Net 30",
        minimumOrderValue: 250,
        leadTimeDays: 3,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const supplierId = supplier!._id as Types.ObjectId;
  console.log(`Supplier ready: ${supplier!.name}`);

  const idByName = new Map<string, Types.ObjectId>();

  const upsertIngredient = async (
    data: SeedIngredient,
    extra: { isPrepped: boolean } = { isPrepped: false },
  ): Promise<Types.ObjectId> => {
    const storage = data.storage ?? STORAGE_BY_CATEGORY[data.category];
    const doc = await Ingredient.findOneAndUpdate(
      { name: data.name },
      {
        $set: {
          description: data.description,
          unit: data.unit,
          minStock: data.minStock,
          reorderPoint: Math.round(data.minStock * 1.5),
          costPerUnit: data.costPerUnit,
          supplier: supplierId,
          category: data.category,
          shelfLife: data.shelfLife,
          storageRequirement: storage,
          isPrepped: extra.isPrepped,
          isActive: true,
        },
        $setOnInsert: { currentStock: data.currentStock },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const id = doc!._id as Types.ObjectId;
    idByName.set(data.name, id);
    return id;
  };

  let rawCount = 0;
  for (const ingredient of RAW_INGREDIENTS) {
    await upsertIngredient(ingredient);
    rawCount += 1;
  }
  console.log(`Raw ingredients upserted: ${rawCount}`);

  let preppedCount = 0;
  let recipeCount = 0;
  for (const prepped of PREPPED_INGREDIENTS) {
    const preppedId = await upsertIngredient(prepped.ingredient, {
      isPrepped: true,
    });
    preppedCount += 1;

    const components = prepped.recipe.map(
      ([rawName, grossQuantity, netQuantity, unit]) => {
        const ingredientId = idByName.get(rawName);
        if (!ingredientId) {
          throw new Error(
            `Recipe for ${prepped.ingredient.name} references unknown raw ingredient "${rawName}"`,
          );
        }
        return {
          ingredientId: String(ingredientId),
          grossQuantity,
          netQuantity,
          yieldFactor: grossQuantity > 0 ? netQuantity / grossQuantity : 0,
          unit,
        };
      },
    );

    const recipe = await Recipe.findOneAndUpdate(
      { targetId: preppedId, targetType: "Ingredient" },
      { $set: { ingredients: components } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    recipeCount += 1;

    await Ingredient.updateOne(
      { _id: preppedId },
      { $set: { recipeId: recipe!._id } },
    );
  }
  console.log(`Prepped ingredients upserted: ${preppedCount}`);
  console.log(`Recipes upserted: ${recipeCount}`);

  const total = await Ingredient.countDocuments();
  console.log(`\nTotal ingredients in catalog: ${total}`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (error) => {
  console.error("Seed error:", error);
  await mongoose.disconnect();
  process.exit(1);
});
