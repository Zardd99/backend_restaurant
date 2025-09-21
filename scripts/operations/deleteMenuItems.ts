import { BaseOperation } from "./baseOperation";
import MenuItem from "../../models/MenuItem";
import mongoose from "mongoose";

export const deleteMenuItems = async (
  filePath?: string,
  id?: string,
  name?: string
): Promise<void> => {
  const operation = new DeleteOperation();
  await operation.execute(filePath, id, name);
};

class DeleteOperation extends BaseOperation {
  constructor() {
    super("DeleteOperation");
  }

  async execute(filePath?: string, id?: string, name?: string): Promise<void> {
    await this.executeOperation(async () => {
      if (filePath) {
        await this.deleteFromFile(filePath);
      } else if (id) {
        await this.deleteById(id);
      } else if (name) {
        await this.deleteByName(name);
      } else {
        this.logger.warn("No deletion criteria provided");
      }
    });
  }

  private async deleteFromFile(filePath: string): Promise<void> {
    const data = await this.loadDataFromFile(filePath);

    if (data.length === 0) {
      this.logger.warn("No data provided for deletion");
      return;
    }

    const ids = data.map((item) => item._id).filter((id) => id);

    if (ids.length === 0) {
      this.logger.warn("No valid IDs found in the provided data");
      return;
    }

    const result = await MenuItem.deleteMany({ _id: { $in: ids } });
    this.logger.info(`Deleted ${result.deletedCount} menu items`);
  }

  private async deleteById(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }

    const result = await MenuItem.findByIdAndDelete(id);

    if (!result) {
      this.logger.warn(`Item with ID ${id} not found`);
    } else {
      this.logger.info(`Deleted menu item with ID: ${id}`);
    }
  }

  private async deleteByName(name: string): Promise<void> {
    const result = await MenuItem.deleteMany({ name });
    this.logger.info(
      `Deleted ${result.deletedCount} menu items with name: ${name}`
    );
  }
}
