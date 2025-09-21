import { BaseOperation } from "./baseOperation";
import MenuItem from "../../models/MenuItem";
import { menuItemsData } from "../data/menuItems";
import { validateMenuItems, checkForDuplicates } from "../utils/validation";
import { MenuItemData, OperationResult } from "../types";

/**
 * Inserts menu items into the database from either a file or provided data
 * @param filePath - Optional path to a file containing menu item data
 * @param dataString - Optional string containing menu item data
 * @returns Promise that resolves when the operation is complete
 * @throws Error if the operation fails
 */
export const insertMenuItems = async (
  filePath?: string,
  dataString?: string
): Promise<OperationResult> => {
  const operation = new InsertOperation();
  return await operation.execute(filePath, dataString);
};

/**
 * Operation class for inserting menu items into the database
 * Handles data validation, duplicate checking, and bulk insertion
 */
class InsertOperation extends BaseOperation {
  constructor() {
    super("InsertOperation");
  }

  /**
   * Executes the menu item insertion operation
   * @param filePath - Optional path to a file containing menu item data
   * @param dataString - Optional string containing menu item data
   * @returns OperationResult indicating success/failure and containing relevant data
   */
  async execute(
    filePath?: string,
    dataString?: string
  ): Promise<OperationResult> {
    return await this.executeOperation(async () => {
      let data: MenuItemData[];

      // Load data from appropriate source
      if (filePath) {
        data = await this.loadDataFromFile(filePath);
      } else if (dataString) {
        data = this.loadData(dataString, menuItemsData as MenuItemData[]);
      } else {
        // Use default data if no source provided
        data = menuItemsData as MenuItemData[];
      }

      // Validate that we have data to process
      if (!data || data.length === 0) {
        const message = "No data provided for insertion";
        this.logger.warn(message);
        return {
          success: false,
          message,
          data: null,
        };
      }

      // Validate menu item structure and required fields
      validateMenuItems(data);

      // Check for duplicates and only insert new items
      const { newItems, duplicates } = await this.filterDuplicates(data);

      // Log duplicates for debugging purposes
      if (duplicates.length > 0) {
        this.logger.warn(`Skipping ${duplicates.length} duplicate items`);
        duplicates.forEach((duplicate) => {
          this.logger.debug(`Duplicate: ${duplicate.name}`);
        });
      }

      // Handle case where no new items are available for insertion
      if (newItems.length === 0) {
        const message = "No new items to insert";
        this.logger.warn(message);
        return {
          success: true,
          message,
          data: {
            inserted: [],
            skipped: duplicates,
          },
        };
      }

      // Perform bulk insertion of new menu items
      const result = await MenuItem.insertMany(newItems, { ordered: false });

      // Log operation results
      this.logger.info(`Inserted ${result.length} new menu items`);
      this.logger.info(`Skipped ${duplicates.length} duplicate items`);

      // Return comprehensive operation result
      return {
        success: true,
        message: `Successfully inserted ${result.length} menu items`,
        data: {
          inserted: result,
          skipped: duplicates,
        },
      };
    });
  }

  /**
   * Filters out duplicate menu items by checking against existing database entries
   * @param data - Array of menu item data to check for duplicates
   * @returns Object containing newItems (non-duplicates) and duplicates
   */
  private async filterDuplicates(
    data: MenuItemData[]
  ): Promise<{ newItems: MenuItemData[]; duplicates: MenuItemData[] }> {
    return await checkForDuplicates(data, MenuItem as any, "name");
  }
}
