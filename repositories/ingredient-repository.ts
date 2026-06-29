import type { ClientSession } from "mongoose";
import { Ingredient } from "../models/ingredient";
import { Result } from "../shared/result";

export interface IngredientDeduction {
  ingredientId: string;
  quantity: number;
}

export interface IngredientRepository {
  findById(id: string): Promise<Result<Ingredient | null>>;
  findByIds(ids: string[]): Promise<Result<Ingredient[]>>;
  findAll(): Promise<Result<Ingredient[]>>;
  save(ingredient: Ingredient): Promise<Result<Ingredient>>;
  findLowStockIngredients(): Promise<Result<Ingredient[]>>;
  /**
   * Atomically apply a batch of stock deductions as an all-or-nothing unit.
   *
   * When no external session is supplied the implementation opens its own
   * MongoDB transaction; pass a session to compose this with other writes
   * (e.g. order creation) inside one transaction.
   */
  consumeAtomic(
    deductions: IngredientDeduction[],
    session?: ClientSession,
  ): Promise<Result<void>>;
}
