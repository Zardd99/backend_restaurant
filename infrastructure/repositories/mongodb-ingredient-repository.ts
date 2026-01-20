import { IngredientRepository } from "../../repositories/ingredient-repository";
import { Ingredient } from "../../models/ingredient";
import { Result, ok, err } from "../../shared/result";
import mongoose from "mongoose";

export class MongoDBIngredientRepository implements IngredientRepository {
  private ingredientModel: mongoose.Model<any>;

  constructor(ingredientModel: mongoose.Model<any>) {
    this.ingredientModel = ingredientModel;
  }

  async findById(id: string): Promise<Result<Ingredient | null>> {
    try {
      const doc = await this.ingredientModel.findById(id);
      if (!doc) {
        return ok(null);
      }

      return Ingredient.create(
        doc._id.toString(),
        doc.name,
        doc.description,
        doc.unit,
        doc.currentStock,
        doc.minStock,
        doc.costPerUnit,
        doc.supplier.toString(),
        doc.category,
        doc.shelfLife,
        doc.isActive,
      );
    } catch (error) {
      return err(
        new Error(
          `Failed to find ingredient: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async findByIds(ids: string[]): Promise<Result<Ingredient[]>> {
    try {
      const docs = await this.ingredientModel.find({
        _id: { $in: ids },
      });

      const ingredients: Ingredient[] = [];
      for (const doc of docs) {
        const ingredientResult = Ingredient.create(
          doc._id.toString(),
          doc.name,
          doc.description,
          doc.unit,
          doc.currentStock,
          doc.minStock,
          doc.costPerUnit,
          doc.supplier.toString(),
          doc.category,
          doc.shelfLife,
          doc.isActive,
        );

        if (ingredientResult.success) {
          ingredients.push(ingredientResult.value);
        }
      }

      return ok(ingredients);
    } catch (error) {
      return err(
        new Error(
          `Failed to find ingredients: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async findAll(): Promise<Result<Ingredient[]>> {
    try {
      const docs = await this.ingredientModel.find({ isActive: true });
      const ingredients: Ingredient[] = [];

      for (const doc of docs) {
        const ingredientResult = Ingredient.create(
          doc._id.toString(),
          doc.name,
          doc.description,
          doc.unit,
          doc.currentStock,
          doc.minStock,
          doc.costPerUnit,
          doc.supplier.toString(),
          doc.category,
          doc.shelfLife,
          doc.isActive,
        );

        if (ingredientResult.success) {
          ingredients.push(ingredientResult.value);
        }
      }

      return ok(ingredients);
    } catch (error) {
      return err(
        new Error(
          `Failed to find ingredients: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async save(ingredient: Ingredient): Promise<Result<Ingredient>> {
    try {
      const updateData = {
        name: ingredient.name,
        description: ingredient.description,
        unit: ingredient.unit,
        currentStock: ingredient.getStock(),
        minStock: ingredient.minStock,
        costPerUnit: ingredient.costPerUnit,
        supplier: ingredient.supplierId,
        category: ingredient.category,
        shelfLife: ingredient.shelfLife,
        isActive: ingredient.isActive,
      };

      const doc = await this.ingredientModel.findByIdAndUpdate(
        ingredient.id,
        updateData,
        { new: true, upsert: true },
      );

      return Ingredient.create(
        doc._id.toString(),
        doc.name,
        doc.description,
        doc.unit,
        doc.currentStock,
        doc.minStock,
        doc.costPerUnit,
        doc.supplier.toString(),
        doc.category,
        doc.shelfLife,
        doc.isActive,
      );
    } catch (error) {
      return err(
        new Error(
          `Failed to save ingredient: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }

  async findLowStockIngredients(): Promise<Result<Ingredient[]>> {
    try {
      const docs = await this.ingredientModel.find({
        isActive: true,
        $expr: { $lte: ["$currentStock", "$minStock"] },
      });

      const ingredients: Ingredient[] = [];
      for (const doc of docs) {
        const ingredientResult = Ingredient.create(
          doc._id.toString(),
          doc.name,
          doc.description,
          doc.unit,
          doc.currentStock,
          doc.minStock,
          doc.costPerUnit,
          doc.supplier.toString(),
          doc.category,
          doc.shelfLife,
          doc.isActive,
        );

        if (ingredientResult.success) {
          ingredients.push(ingredientResult.value);
        }
      }

      return ok(ingredients);
    } catch (error) {
      return err(
        new Error(
          `Failed to find low stock ingredients: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }
}
