import { BaseOperation } from "./baseOperation";
import MenuItem from "../../models/MenuItem";

export const queryMenuItems = async (
  category?: string,
  tag?: string,
  available?: boolean
): Promise<void> => {
  const operation = new QueryOperation();
  await operation.execute(category, tag, available);
};

class QueryOperation extends BaseOperation {
  constructor() {
    super("QueryOperation");
  }

  async execute(
    category?: string,
    tag?: string,
    available?: boolean
  ): Promise<void> {
    await this.executeOperation(async () => {
      const filter: any = {};

      if (category) {
        filter.category = category;
      }

      if (tag) {
        filter.dietaryTags = tag;
      }

      if (available !== undefined) {
        filter.isAvailable = available;
      }

      const items = await MenuItem.find(filter);

      this.logger.info(`Found ${items.length} menu items`);
      console.log(JSON.stringify(items, null, 2));

      return items;
    });
  }
}
