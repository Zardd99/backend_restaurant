import { ObjectId } from "mongoose";
import { Result, ok, err } from "../shared/result";

export interface IngredientReference {
  ingredientId: string;
  quantity: number;
}

export class Ingredient {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly unit: string,
    private currentStock: number,
    public readonly minStock: number,
    public readonly costPerUnit: number,
    public readonly supplierId: ObjectId,
    public readonly category: string,
    public readonly shelfLife?: number,
    public readonly isActive: boolean = true,
  ) {}

  static create(
    id: string,
    name: string,
    description: string,
    unit: string,
    currentStock: number,
    minStock: number,
    costPerUnit: number,
    supplierId: ObjectId,
    category: string,
    shelfLife?: number,
    isActive: boolean = true,
  ): Result<Ingredient> {
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
        costPerUnit,
        supplierId,
        category.trim(),
        shelfLife,
        isActive,
      ),
    );
  }

  isLowStock(): boolean {
    return this.currentStock <= this.minStock;
  }

  getStock(): number {
    return this.currentStock;
  }

  consume(quantity: number): Result<Ingredient> {
    if (quantity <= 0) {
      return err(new Error("Consumption quantity must be positive"));
    }
    if (quantity > this.currentStock) {
      return err(
        new Error(
          `Insufficient stock. Available: ${this.currentStock}, Required: ${quantity}`,
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
}

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
      ),
    );
  }

  getRequiredIngredients(): ReadonlyArray<IngredientReference> {
    return [...this.ingredientReferences];
  }
}
