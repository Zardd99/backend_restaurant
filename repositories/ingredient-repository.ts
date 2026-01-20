import { Ingredient } from "../models/ingredient";
import { Result } from "../shared/result";

export interface IngredientRepository {
  findById(id: string): Promise<Result<Ingredient | null>>;
  findByIds(ids: string[]): Promise<Result<Ingredient[]>>;
  findAll(): Promise<Result<Ingredient[]>>;
  save(ingredient: Ingredient): Promise<Result<Ingredient>>;
  findLowStockIngredients(): Promise<Result<Ingredient[]>>;
}
