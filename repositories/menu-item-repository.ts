import { MenuItem } from "../models/ingredient";
import { Result } from "../shared/result";

export interface MenuItemRepository {
  findById(id: string): Promise<Result<MenuItem | null>>;
  findAllActive(): Promise<Result<MenuItem[]>>;
  findByIds(ids: string[]): Promise<Result<MenuItem[]>>;
  save(menuItem: MenuItem): Promise<Result<MenuItem>>;
}
