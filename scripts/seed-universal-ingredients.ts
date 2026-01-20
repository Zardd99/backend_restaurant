import mongoose from "mongoose";
import { Supplier, Ingredient } from "../models/Supplier";

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
];

async function seedIngredients() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
  );

  // Create a default supplier
  const supplier = await Supplier.create({
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

  // Create universal ingredients
  for (const ingredientData of universalIngredients) {
    await Ingredient.create({
      ...ingredientData,
      supplier: supplier._id,
      isActive: true,
    });
  }

  console.log("Universal ingredients seeded successfully");
  await mongoose.disconnect();
}

seedIngredients().catch(console.error);
