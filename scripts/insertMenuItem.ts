import mongoose from "mongoose";
import dotenv from "dotenv";
import MenuItem from "../models/MenuItem";
import connectDB from "../config/db";

dotenv.config();

// List of Menu Item will be insert as array of objects
const menuItemsData = [
  {
    name: "Margherita Pizza",
    description:
      "Classic pizza with tomato sauce, mozzarella, and fresh basil.",
    price: 12.99,
    category: new mongoose.Types.ObjectId("64f8c2e2b8d1e5a1c2b3a4f7"),
    imageUrl: "images/margherita.jpg",
    ingredients: ["Tomato Sauce", "Mozzarella", "Basil", "Olive Oil"],
    dietaryTags: ["vegetarian"],
    isAvailable: true,
    preparationTime: 20,
    chefSpecial: true,
    averageRating: 4.7,
    reviewCount: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Veggie Burger",
    description: "Plant-based burger with fresh vegetables.",
    price: 9.99,
    category: new mongoose.Types.ObjectId("64f8c2e2b8d1e5a1c2b3a4f8"),
  },
];

interface MongoError extends Error {
  code?: number;
  errmsg?: string;
}

interface ValidationError extends Error {
  errors?: {
    [path: string]: mongoose.Error.ValidatorError | mongoose.Error.CastError;
  };
}

function isMongoError(error: unknown): error is MongoError {
  return error instanceof Error && "code" in error;
}

function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && "errors" in error;
}

async function insertMenuItems() {
  try {
    await connectDB();
    console.log("Connected to database successfully!");

    // Check which items already exist
    const existingItems = await MenuItem.find({
      name: { $in: menuItemsData.map((item) => item.name) },
    });

    const existingNames = new Set(existingItems.map((item) => item.name));
    const itemsToInsert = menuItemsData.filter(
      (item) => !existingNames.has(item.name)
    );

    if (itemsToInsert.length > 0) {
      const savedItems = await MenuItem.insertMany(itemsToInsert, {
        ordered: false,
      });
      console.log(`${savedItems.length} new menu items inserted successfully!`);
    } else {
      console.log("All menu items already exist in the database.");
    }
  } catch (error) {
    console.error("Error inserting documents:", error);

    if (isMongoError(error) && error.code === 11000) {
      console.error("Duplicate key error - some items might already exist");
    }

    if (isValidationError(error) && error.errors) {
      console.error("Validation errors:");
      Object.keys(error.errors).forEach((key) => {
        console.error(`- ${key}: ${error.errors![key].message}`);
      });
    }
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  }
}

insertMenuItems();
