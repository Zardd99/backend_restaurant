import { ClientSession, Types } from "mongoose";
import MenuItem from "../models/MenuItem";
import { Ingredient as IngredientModel } from "../models/Supplier";

export interface OrderLine {
  menuItem: Types.ObjectId | string;
  quantity: number;
}

interface IngredientRef {
  ingredient: Types.ObjectId;
  quantity: number;
  unit: string;
}

/**
 * Apply recipe-driven stock changes for a set of order lines inside a session.
 *
 * sign = -1 deducts (items added to an order); sign = +1 credits back (items
 * removed / order voided). Deductions use a conditional `$inc` so concurrent
 * writers cannot drive stock negative; an insufficient deduction throws
 * `INSUFFICIENT_STOCK:<ingredientId>` to abort the surrounding transaction.
 */
export async function applyInventoryDelta(
  lines: OrderLine[],
  sign: -1 | 1,
  session: ClientSession,
): Promise<void> {
  const menuItemIds = lines.map((line) => String(line.menuItem));
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } })
    .session(session)
    .lean();

  const recipeByMenuItem = new Map<string, IngredientRef[]>(
    menuItems.map((mi) => [
      String(mi._id),
      ((mi as { ingredientReferences?: IngredientRef[] }).ingredientReferences ??
        []) as IngredientRef[],
    ]),
  );

  const deltaByIngredient = new Map<string, number>();
  for (const line of lines) {
    const refs = recipeByMenuItem.get(String(line.menuItem)) ?? [];
    for (const ref of refs) {
      const id = String(ref.ingredient);
      deltaByIngredient.set(
        id,
        (deltaByIngredient.get(id) ?? 0) + ref.quantity * line.quantity * sign,
      );
    }
  }

  for (const [ingredientId, delta] of deltaByIngredient) {
    if (delta === 0) continue;

    if (delta < 0) {
      const result = await IngredientModel.updateOne(
        { _id: ingredientId, currentStock: { $gte: -delta } },
        { $inc: { currentStock: delta } },
        { session },
      );
      if (result.modifiedCount !== 1) {
        throw new Error(`INSUFFICIENT_STOCK:${ingredientId}`);
      }
    } else {
      await IngredientModel.updateOne(
        { _id: ingredientId },
        { $inc: { currentStock: delta } },
        { session },
      );
    }
  }
}
