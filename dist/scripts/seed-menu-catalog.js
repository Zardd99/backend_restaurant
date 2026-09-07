"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const Category_1 = __importDefault(require("../models/Category"));
dotenv_1.default.config();
const CLEAN_CATEGORIES = [
    "Appetizers",
    "Soups",
    "Salads",
    "Pizza",
    "Burgers & Sandwiches",
    "Main Courses",
    "Breakfast",
    "Desserts",
    "Beverages",
];
const ITEM_CATEGORY = {
    "Margherita Pizza": "Pizza",
    "Pepperoni Pizza": "Pizza",
    "BBQ Chicken Pizza": "Pizza",
    "Caesar Salad": "Salads",
    "Cobb Salad": "Salads",
    "Greek Salad": "Salads",
    "Berry Salad": "Salads",
    "Bison Burgers": "Burgers & Sandwiches",
    "Beef Burger": "Burgers & Sandwiches",
    "Grill Sandwich": "Burgers & Sandwiches",
    "Chicken Club Sandwich": "Burgers & Sandwiches",
    "Caprese Panini": "Burgers & Sandwiches",
    "Chicken Caesar Wrap": "Burgers & Sandwiches",
    "Grilled Cheese Sandwich": "Burgers & Sandwiches",
    "Beef Pho": "Soups",
    "Chicken Noodle Soup": "Soups",
    "French Onion Soup": "Soups",
    "Beef Nachos": "Appetizers",
    "Buffalo Wings": "Appetizers",
    "Chicken Popeyes": "Main Courses",
    "Fish Tacos": "Main Courses",
    "Chicken Quesadilla": "Main Courses",
    "Beef Burrito": "Main Courses",
    "Beef Steak": "Main Courses",
    "Chicken Fried Rice": "Main Courses",
    "Chicken Tikka Masala": "Main Courses",
    "Chicken Parmesan": "Main Courses",
    "Eggplant Parmesan": "Main Courses",
    "Beef Kebabs": "Main Courses",
    "Falafel Plate": "Main Courses",
    "Greek Yogurt with Honey": "Breakfast",
    "Avocado Toast": "Breakfast",
    "Blueberry Pancakes": "Breakfast",
    "Chocolate Lava Cake": "Desserts",
    "Creme Brulee": "Desserts",
    "Fruit Parfait": "Desserts",
    "Apple Pie": "Desserts",
    "Banana Bread": "Desserts",
    "Chocolate Chip Cookies": "Desserts",
    "Iced Tea": "Beverages",
    "Chocolate Milkshake": "Beverages",
    "Iced Coffee": "Beverages",
    "Lemonade": "Beverages",
    "Ice Capuccino": "Beverages",
};
const NEW_DISHES = [
    { name: "Mozzarella Sticks", description: "Golden-fried mozzarella with a crisp panko crust, served with marinara dip.", price: 7.49, categoryName: "Appetizers", dietaryTags: ["vegetarian"], preparationTime: 10, chefSpecial: false },
    { name: "Garlic Bread", description: "Toasted ciabatta brushed with roasted garlic butter and herbs.", price: 5.49, categoryName: "Appetizers", dietaryTags: ["vegetarian"], preparationTime: 8, chefSpecial: false },
    { name: "Bruschetta", description: "Grilled sourdough topped with marinated tomatoes, basil, and olive oil.", price: 6.99, categoryName: "Appetizers", dietaryTags: ["vegetarian", "vegan"], preparationTime: 9, chefSpecial: false },
    { name: "Spring Rolls", description: "Crispy vegetable spring rolls with a sweet chili dipping sauce.", price: 6.49, categoryName: "Appetizers", dietaryTags: ["vegan", "dairy-free"], preparationTime: 10, chefSpecial: false },
    { name: "Hawaiian Pizza", description: "Tomato base with mozzarella, smoked ham, and sweet pineapple.", price: 15.49, categoryName: "Pizza", dietaryTags: [], preparationTime: 22, chefSpecial: false },
    { name: "Four Cheese Pizza", description: "Mozzarella, gorgonzola, parmesan, and fontina on a thin crust.", price: 15.99, categoryName: "Pizza", dietaryTags: ["vegetarian"], preparationTime: 22, chefSpecial: true },
    { name: "Tomato Basil Soup", description: "Velvety roasted tomato soup finished with fresh basil and cream.", price: 6.99, categoryName: "Soups", dietaryTags: ["vegetarian", "gluten-free"], preparationTime: 12, chefSpecial: false },
    { name: "Minestrone Soup", description: "Hearty Italian vegetable and bean soup with small pasta.", price: 7.49, categoryName: "Soups", dietaryTags: ["vegetarian", "vegan"], preparationTime: 14, chefSpecial: false },
    { name: "Mango Smoothie", description: "Blended ripe mango with coconut milk and a hint of lime.", price: 5.99, categoryName: "Beverages", dietaryTags: ["vegan", "gluten-free", "dairy-free"], preparationTime: 4, chefSpecial: false },
    { name: "Fresh Orange Juice", description: "Cold-pressed seasonal oranges, served chilled.", price: 4.49, categoryName: "Beverages", dietaryTags: ["vegan", "gluten-free", "dairy-free"], preparationTime: 3, chefSpecial: false },
    { name: "Tiramisu", description: "Espresso-soaked ladyfingers layered with mascarpone and cocoa.", price: 8.49, categoryName: "Desserts", dietaryTags: ["vegetarian"], preparationTime: 6, chefSpecial: true },
    { name: "New York Cheesecake", description: "Classic dense cheesecake on a graham crust with berry compote.", price: 8.99, categoryName: "Desserts", dietaryTags: ["vegetarian"], preparationTime: 5, chefSpecial: false },
];
async function run() {
    await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant");
    console.log("Connected.");
    const idByName = new Map();
    for (const name of CLEAN_CATEGORIES) {
        const doc = await Category_1.default.findOneAndUpdate({ name }, { name }, { upsert: true, new: true, setDefaultsOnInsert: true });
        idByName.set(name, doc._id);
    }
    console.log(`Clean categories ready: ${CLEAN_CATEGORIES.length}`);
    const items = await MenuItem_1.default.find({}).lean();
    let remapped = 0;
    const unmatched = [];
    for (const it of items) {
        const targetName = ITEM_CATEGORY[it.name];
        if (!targetName) {
            unmatched.push(it.name);
            continue;
        }
        const targetId = idByName.get(targetName);
        if (String(it.category) !== String(targetId)) {
            await MenuItem_1.default.updateOne({ _id: it._id }, { $set: { category: targetId } });
            remapped++;
        }
    }
    for (const name of unmatched) {
        await MenuItem_1.default.updateOne({ name }, { $set: { category: idByName.get("Main Courses") } });
    }
    if (unmatched.length) {
        console.log(`Unmatched items defaulted to Main Courses: ${unmatched.join(", ")}`);
    }
    let added = 0;
    for (const d of NEW_DISHES) {
        const exists = await MenuItem_1.default.findOne({ name: d.name });
        if (exists)
            continue;
        await MenuItem_1.default.create({
            name: d.name,
            description: d.description,
            price: d.price,
            category: idByName.get(d.categoryName),
            image: "",
            ingredientReferences: [],
            dietaryTags: d.dietaryTags,
            availability: true,
            preparationTime: d.preparationTime,
            chefSpecial: d.chefSpecial,
        });
        added++;
    }
    const del = await Category_1.default.deleteMany({ name: { $nin: CLEAN_CATEGORIES } });
    console.log("\n=== SUMMARY ===");
    console.log(`  items remapped:      ${remapped}`);
    console.log(`  new dishes added:    ${added}`);
    console.log(`  junk categories del: ${del.deletedCount}`);
    console.log("\n=== ITEMS PER CATEGORY ===");
    for (const name of CLEAN_CATEGORIES) {
        const count = await MenuItem_1.default.countDocuments({ category: idByName.get(name) });
        console.log(`  ${name.padEnd(22)} ${count}`);
    }
    await mongoose_1.default.disconnect();
    console.log("\nDone.");
}
run().catch(async (e) => {
    console.error("migration error:", e);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed-menu-catalog.js.map