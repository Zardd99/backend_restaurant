import { Types } from "mongoose";
import { Result, ok, err } from "../shared/result";

export interface IngredientReference {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface ConsumptionResult {
  ingredientId: string;
  consumedQuantity: number;
  remainingStock: number;
  isLowStock: boolean;
  needsReorder: boolean;
}

export class Ingredient {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly unit: string,
    private currentStock: number,
    public readonly minStock: number,
    public readonly reorderPoint: number,
    public readonly costPerUnit: number,
    public readonly supplierId: any, // Use any for ObjectId to avoid type issues
    public readonly category: string,
    public readonly shelfLife?: number,
    public readonly isActive: boolean = true,
    public readonly lastRestocked?: Date,
    public readonly lastConsumed?: Date,
  ) {}

  static create(
    id: string,
    name: string,
    description: string,
    unit: string,
    currentStock: number,
    minStock: number,
    reorderPoint: number,
    costPerUnit: number,
    supplierId: any, // Use any for ObjectId
    category: string,
    shelfLife?: number,
    isActive: boolean = true,
  ): Result<Ingredient> {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      return err(new Error("Ingredient name is required"));
    }
    if (unit.trim().length === 0) {
      return err(new Error("Unit is required"));
    }
    if (currentStock < 0) {
      return err(new Error("Current stock cannot be negative"));
    }
    if (minStock < 0) {
      return err(new Error("Minimum stock cannot be negative"));
    }
    if (reorderPoint < 0) {
      return err(new Error("Reorder point cannot be negative"));
    }
    if (reorderPoint < minStock) {
      return err(
        new Error(
          "Reorder point must be greater than or equal to minimum stock",
        ),
      );
    }
    if (costPerUnit <= 0) {
      return err(new Error("Cost per unit must be positive"));
    }
    if (!supplierId) {
      return err(new Error("Supplier ID is required"));
    }

    return ok(
      new Ingredient(
        id,
        name.trim(),
        description.trim(),
        unit.trim(),
        currentStock,
        minStock,
        reorderPoint,
        costPerUnit,
        supplierId,
        category.trim(),
        shelfLife,
        isActive,
      ),
    );
  }

  // ... rest of the methods remain the same ...
  isLowStock(): boolean {
    return this.currentStock <= this.minStock;
  }

  needsReorder(): boolean {
    return this.currentStock <= this.reorderPoint;
  }

  getStock(): number {
    return this.currentStock;
  }

  getStockLevel(): "NORMAL" | "LOW" | "CRITICAL" {
    if (this.currentStock <= this.minStock) return "CRITICAL";
    if (this.currentStock <= this.reorderPoint) return "LOW";
    return "NORMAL";
  }

  consume(quantity: number): Result<Ingredient> {
    if (quantity <= 0) {
      return err(new Error("Consumption quantity must be positive"));
    }
    if (quantity > this.currentStock) {
      return err(
        new Error(
          `Insufficient stock. Available: ${this.currentStock}${this.unit}, Required: ${quantity}${this.unit}`,
        ),
      );
    }

    this.currentStock -= quantity;
    return ok(this);
  }

  replenish(quantity: number): Result<Ingredient> {
    if (quantity <= 0) {
      return err(new Error("Replenishment quantity must be positive"));
    }

    this.currentStock += quantity;
    return ok(this);
  }

  setStock(newStock: number): Result<Ingredient> {
    if (newStock < 0) {
      return err(new Error("Stock cannot be negative"));
    }

    this.currentStock = newStock;
    return ok(this);
  }

  calculateCost(quantity: number): number {
    return this.costPerUnit * quantity;
  }
}

// MenuItem class remains the same...
export class MenuItem {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly ingredientReferences: IngredientReference[],
    public readonly preparationTime: number,
    public readonly isActive: boolean = true,
    public readonly costPrice?: number,
    public readonly profitMargin?: number,
  ) {}

  static create(
    id: string,
    name: string,
    description: string,
    price: number,
    categoryId: string,
    ingredientReferences: IngredientReference[],
    preparationTime: number,
    isActive: boolean = true,
    costPrice?: number,
    profitMargin?: number,
  ): Result<MenuItem> {
    if (!name || name.trim().length === 0) {
      return err(new Error("Menu item name is required"));
    }
    if (price <= 0) {
      return err(new Error("Price must be positive"));
    }
    if (!categoryId) {
      return err(new Error("Category ID is required"));
    }
    if (preparationTime <= 0) {
      return err(new Error("Preparation time must be positive"));
    }

    // Validate ingredient references
    for (const ref of ingredientReferences) {
      if (!ref.ingredientId) {
        return err(new Error("Ingredient ID is required in references"));
      }
      if (ref.quantity <= 0) {
        return err(new Error("Ingredient quantity must be positive"));
      }
      if (!ref.unit || ref.unit.trim().length === 0) {
        return err(new Error("Ingredient unit is required"));
      }
    }

    return ok(
      new MenuItem(
        id,
        name.trim(),
        description.trim(),
        price,
        categoryId,
        ingredientReferences,
        preparationTime,
        isActive,
        costPrice,
        profitMargin,
      ),
    );
  }

  getRequiredIngredients(): ReadonlyArray<IngredientReference> {
    return [...this.ingredientReferences];
  }

  calculateTotalCost(ingredients: Map<string, Ingredient>): number {
    let totalCost = 0;
    for (const ref of this.ingredientReferences) {
      const ingredient = ingredients.get(ref.ingredientId);
      if (ingredient) {
        totalCost += ingredient.calculateCost(ref.quantity);
      }
    }
    return totalCost;
  }
}
