/**
 * Menu catalog migration.
 *
 * 1. Upserts a clean 9-category taxonomy.
 * 2. Remaps every existing menu item to the correct category (by dish name).
 * 3. Adds new dishes to round out thin categories.
 * 4. Deletes all leftover (junk) categories.
 *
 * Idempotent: safe to re-run. Uses updateOne for remap so the MenuItem
 * pre-save cost hook (which needs the Ingredient model) is not triggered.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import MenuItem from "../models/MenuItem";
import Category from "../models/Category";

dotenv.config();

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

// Existing 44 dishes -> correct clean category (matched by exact name).
const ITEM_CATEGORY: Record<string, string> = {
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

interface NewDish {
  name: string;
  description: string;
  price: number;
  categoryName: string;
  dietaryTags: string[];
  preparationTime: number;
  chefSpecial: boolean;
}

const NEW_DISHES: NewDish[] = [
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
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
  );
  console.log("Connected.");

  // 1. Upsert clean categories.
  const idByName = new Map<string, mongoose.Types.ObjectId>();
  for (const name of CLEAN_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { name },
      { name },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    idByName.set(name, doc!._id as mongoose.Types.ObjectId);
  }
  console.log(`Clean categories ready: ${CLEAN_CATEGORIES.length}`);

  // 2. Remap existing items.
  const items = await MenuItem.find({}).lean();
  let remapped = 0;
  const unmatched: string[] = [];
  for (const it of items as any[]) {
    const targetName = ITEM_CATEGORY[it.name];
    if (!targetName) {
      unmatched.push(it.name);
      continue;
    }
    const targetId = idByName.get(targetName)!;
    if (String(it.category) !== String(targetId)) {
      await MenuItem.updateOne(
        { _id: it._id },
        { $set: { category: targetId } },
      );
      remapped++;
    }
  }

  // Unmatched (e.g. items added after this script was written) -> Main Courses.
  for (const name of unmatched) {
    await MenuItem.updateOne(
      { name },
      { $set: { category: idByName.get("Main Courses")! } },
    );
  }
  if (unmatched.length) {
    console.log(
      `Unmatched items defaulted to Main Courses: ${unmatched.join(", ")}`,
    );
  }

  // 3. Add new dishes (skip if name already exists).
  let added = 0;
  for (const d of NEW_DISHES) {
    const exists = await MenuItem.findOne({ name: d.name });
    if (exists) continue;
    await MenuItem.create({
      name: d.name,
      description: d.description,
      price: d.price,
      category: idByName.get(d.categoryName)!,
      image: "",
      ingredientReferences: [],
      dietaryTags: d.dietaryTags,
      availability: true,
      preparationTime: d.preparationTime,
      chefSpecial: d.chefSpecial,
    });
    added++;
  }

  // 4. Delete leftover junk categories.
  const del = await Category.deleteMany({ name: { $nin: CLEAN_CATEGORIES } });

  console.log("\n=== SUMMARY ===");
  console.log(`  items remapped:      ${remapped}`);
  console.log(`  new dishes added:    ${added}`);
  console.log(`  junk categories del: ${del.deletedCount}`);

  // Per-category counts after migration.
  console.log("\n=== ITEMS PER CATEGORY ===");
  for (const name of CLEAN_CATEGORIES) {
    const count = await MenuItem.countDocuments({ category: idByName.get(name)! });
    console.log(`  ${name.padEnd(22)} ${count}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(async (e) => {
  console.error("migration error:", e);
  await mongoose.disconnect();
  process.exit(1);
});
