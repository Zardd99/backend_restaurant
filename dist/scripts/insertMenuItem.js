"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const db_1 = __importDefault(require("../config/db"));
dotenv_1.default.config();
const menuItemsData = [
    {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella, and fresh basil.",
        price: 12.99,
        category: new mongoose_1.default.Types.ObjectId("64f8c2e2b8d1e5a1c2b3a4f7"),
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
        category: new mongoose_1.default.Types.ObjectId("64f8c2e2b8d1e5a1c2b3a4f8"),
    },
];
function isMongoError(error) {
    return error instanceof Error && "code" in error;
}
function isValidationError(error) {
    return error instanceof Error && "errors" in error;
}
async function insertMenuItems() {
    try {
        await (0, db_1.default)();
        console.log("Connected to database successfully!");
        const existingItems = await MenuItem_1.default.find({
            name: { $in: menuItemsData.map((item) => item.name) },
        });
        const existingNames = new Set(existingItems.map((item) => item.name));
        const itemsToInsert = menuItemsData.filter((item) => !existingNames.has(item.name));
        if (itemsToInsert.length > 0) {
            const savedItems = await MenuItem_1.default.insertMany(itemsToInsert, {
                ordered: false,
            });
            console.log(`${savedItems.length} new menu items inserted successfully!`);
        }
        else {
            console.log("All menu items already exist in the database.");
        }
    }
    catch (error) {
        console.error("Error inserting documents:", error);
        if (isMongoError(error) && error.code === 11000) {
            console.error("Duplicate key error - some items might already exist");
        }
        if (isValidationError(error) && error.errors) {
            console.error("Validation errors:");
            Object.keys(error.errors).forEach((key) => {
                console.error(`- ${key}: ${error.errors[key].message}`);
            });
        }
    }
    finally {
        await mongoose_1.default.connection.close();
        console.log("MongoDB connection closed");
        process.exit(0);
    }
}
insertMenuItems();
//# sourceMappingURL=insertMenuItem.js.map