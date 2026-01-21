import mongoose from "mongoose";
import { MenuItemRepository } from "../../repositories/menu-item-repository";
import { MenuItem, IngredientReference } from "../../models/ingredient";
import { Result, ok, err } from "../../shared/result";
import { IMenuItem } from "../../models/MenuItem";

export class MongoDBMenuItemRepository implements MenuItemRepository {
  constructor(private menuItemModel: mongoose.Model<IMenuItem>) {}

  async findById(id: string): Promise<Result<MenuItem | null>> {
    try {
      const doc = await this.menuItemModel
        .findById(id)
        .populate("ingredientReferences.ingredient", "name unit costPerUnit")
        .lean()
        .exec();

      if (!doc) {
        return ok(null);
      }

      const ingredientReferences: IngredientReference[] = 
        doc.ingredientReferences?.map((ref: any) => ({
          ingredientId: ref.ingredient?._id?.toString() || "",
          quantity: ref.quantity || 0,
          unit: ref.unit || ref.ingredient?.unit || "unit",
        })) || [];

      return MenuItem.create(
        doc._id.toString(),
        doc.name,
        doc.description || "",
        doc.price,
        doc.category ? doc.category.toString() : "",
        ingredientReferences,
        doc.preparationTime || 15,
        doc.availability !== false,
        doc.costPrice,
        doc.profitMargin
      );
    } catch (error) {
      return err(
        new Error(
          `Failed to find menu item: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      );
    }
  }

  async findByIds(ids: string[]): Promise<Result<MenuItem[]>> {
    try {
      const docs = await this.menuItemModel
        .find({ _id: { $in: ids } })
        .populate("ingredientReferences.ingredient", "name unit costPerUnit")
        .lean()
        .exec();

      const menuItems: MenuItem[] = [];
      
      for (const doc of docs) {
        const ingredientReferences: IngredientReference[] = 
          doc.ingredientReferences?.map((ref: any) => ({
            ingredientId: ref.ingredient?._id?.toString() || "",
            quantity: ref.quantity || 0,
            unit: ref.unit || ref.ingredient?.unit || "unit",
          })) || [];

        const menuItemResult = MenuItem.create(
          doc._id.toString(),
          doc.name,
          doc.description || "",
          doc.price,
          doc.category ? doc.category.toString() : "",
          ingredientReferences,
          doc.preparationTime || 15,
          doc.availability !== false,
          doc.costPrice,
          doc.profitMargin
        );

        if (menuItemResult.success) {
          menuItems.push(menuItemResult.value);
        }
      }

      return ok(menuItems);
    } catch (error) {
      return err(
        new Error(
          `Failed to find menu items: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      );
    }
  }

  async findAllActive(): Promise<Result<MenuItem[]>> {
    try {
      const docs = await this.menuItemModel
        .find({ availability: true })
        .populate("ingredientReferences.ingredient", "name unit costPerUnit")
        .lean()
        .exec();

      const menuItems: MenuItem[] = [];
      
      for (const doc of docs) {
        const ingredientReferences: IngredientReference[] = 
          doc.ingredientReferences?.map((ref: any) => ({
            ingredientId: ref.ingredient?._id?.toString() || "",
            quantity: ref.quantity || 0,
            unit: ref.unit || ref.ingredient?.unit || "unit",
          })) || [];

        const menuItemResult = MenuItem.create(
          doc._id.toString(),
          doc.name,
          doc.description || "",
          doc.price,
          doc.category ? doc.category.toString() : "",
          ingredientReferences,
          doc.preparationTime || 15,
          doc.availability !== false,
          doc.costPrice,
          doc.profitMargin
        );

        if (menuItemResult.success) {
          menuItems.push(menuItemResult.value);
        }
      }

      return ok(menuItems);
    } catch (error) {
      return err(
        new Error(
          `Failed to find menu items: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      );
    }
  }

  async save(menuItem: MenuItem): Promise<Result<MenuItem>> {
    try {
      const updateData = {
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        category: menuItem.categoryId,
        ingredientReferences: menuItem.getRequiredIngredients().map(ref => ({
          ingredient: ref.ingredientId,
          quantity: ref.quantity,
          unit: ref.unit,
        })),
        preparationTime: menuItem.preparationTime,
        availability: menuItem.isActive,
        costPrice: menuItem.costPrice,
        profitMargin: menuItem.profitMargin,
      };

      const doc = await this.menuItemModel
        .findByIdAndUpdate(menuItem.id, updateData, { 
          new: true, 
          upsert: true,
          lean: true 
        })
        .populate("ingredientReferences.ingredient", "name unit costPerUnit")
        .exec();

      if (!doc) {
        return err(new Error("Failed to save menu item"));
      }

      // Convert back to domain model
      const ingredientReferences: IngredientReference[] = 
        doc.ingredientReferences?.map((ref: any) => ({
          ingredientId: ref.ingredient?._id?.toString() || "",
          quantity: ref.quantity || 0,
          unit: ref.unit || ref.ingredient?.unit || "unit",
        })) || [];

      return MenuItem.create(
        doc._id.toString(),
        doc.name,
        doc.description || "",
        doc.price,
        doc.category ? doc.category.toString() : "",
        ingredientReferences,
        doc.preparationTime || 15,
        doc.availability !== false,
        doc.costPrice,
        doc.profitMargin
      );
    } catch (error) {
      return err(
        new Error(
          `Failed to save menu item: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      );
    }
  }
}