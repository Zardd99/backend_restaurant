import { BaseOperation } from "./baseOperation";
import MenuItem from "../../models/MenuItem";
import { validateMenuItems } from "../utils/validation";
import { MenuItemData } from "../types/index";
import { menuItemsData } from "../data/menuItems";

export const updateMenuItems = async (
  filePath?: string,
  dataString?: string
): Promise<void> => {
  const operation = new UpdateOperation();
  await operation.execute(filePath, dataString);
};

class UpdateOperation extends BaseOperation {
  constructor() {
    super("UpdateOperation");
  }

  async execute(filePath?: string, dataString?: string): Promise<void> {
    await this.executeOperation(async () => {
      let data: MenuItemData[];

      if (filePath) {
        data = await this.loadDataFromFile(filePath);
      } else {
        data = this.loadData(
          dataString as string,
          menuItemsData as MenuItemData[]
        );
      }

      if (data.length === 0) {
        this.logger.warn("No data provided for update");
        return;
      }

      validateMenuItems(data);

      const updateOperations = data.map(async (item) => {
        // dont use _id here it not in the document
        if (!item.name) {
          throw new Error("Missing name field for update operation");
        }

        const { name, ...updateData } = item;
        const result = await MenuItem.findByIdAndUpdate(
          name,
          { $set: updateData },
          { new: true, runValidators: true }
        );

        if (!result) {
          this.logger.warn(`Item with ID ${name} not found`);
        }

        return result;
      });

      const results = await Promise.all(updateOperations);
      const successfulUpdates = results.filter((result) => result !== null);

      this.logger.info(`Updated ${successfulUpdates.length} menu items`);
      return successfulUpdates;
    });
  }
}
