import mongoose from "mongoose";
import { MenuItemData } from "../types";
import { IMenuItem } from "../../types/index";

export function validateMenuItems(data: MenuItemData[]): void {
  if (!Array.isArray(data)) {
    throw new Error("Data must be an array");
  }

  data.forEach((item, index) => {
    if (!item.name || typeof item.name !== "string") {
      throw new Error(`Item at index ${index} is missing a valid name`);
    }

    if (!item.description || typeof item.description !== "string") {
      throw new Error(`Item at index ${index} is missing a valid description`);
    }

    if (typeof item.price !== "number" || item.price <= 0) {
      throw new Error(`Item at index ${index} must have a valid price`);
    }

    if (!item.category || !mongoose.Types.ObjectId.isValid(item.category)) {
      throw new Error(`Item at index ${index} must have a valid category ID`);
    }

    if (!Array.isArray(item.ingredientReferences)) {
      throw new Error(
        `Item at index ${index} must have an array of ingredients`
      );
    }

    if (!Array.isArray(item.dietaryTags)) {
      throw new Error(
        `Item at index ${index} must have an array of dietary tags`
      );
    }

    if (typeof item.availability !== "boolean") {
      throw new Error(
        `Item at index ${index} must have a valid isAvailable boolean`
      );
    }

    if (typeof item.preparationTime !== "number" || item.preparationTime <= 0) {
      throw new Error(
        `Item at index ${index} must have a valid preparation time`
      );
    }
  });
}

export async function checkForDuplicates(
  data: MenuItemData[],
  model: mongoose.Model<IMenuItem>,
  field: string = "name"
): Promise<{ newItems: MenuItemData[]; duplicates: MenuItemData[] }> {
  // Extract values from the data to check for duplicates
  const values = data.map((item) => item[field]);

  // Find existing items with these values
  const existingItems = await model.find({
    [field]: { $in: values },
  });

  const existingValues = new Set(
    existingItems.map(
      (item) => (item.toObject() as unknown as Record<string, unknown>)[field]
    )
  );

  // Separate new items from duplicates
  const newItems = data.filter((item) => !existingValues.has(item[field]));
  const duplicates = data.filter((item) => existingValues.has(item[field]));

  return { newItems, duplicates };
}
