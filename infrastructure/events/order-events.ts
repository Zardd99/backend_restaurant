import { EventEmitter } from "events";
import { Types } from "mongoose";
import { DependencyContainer } from "../../config/dependencies";
import {
  KdsPacingService,
  PaceItemInput,
} from "../../services/KdsPacingService";
import MenuItem from "../../models/MenuItem";
import { KdsStation } from "../../models/KdsTicket";

/**
 * Order domain event broker.
 *
 * A single process-wide {@link EventEmitter} that decouples the order-creation
 * transaction from downstream side effects (KDS ticket paving today, more
 * subscribers later). Emitting only *after* the order has been persisted keeps
 * the write path fast and lets listeners run asynchronously without ever
 * blocking — or rolling back — the order response.
 *
 * Importing this broker (not `KdsPacingService`) from the order controller also
 * breaks the otherwise-circular import chain between the order flow and the KDS
 * service.
 */

export interface OrderCreatedEventItem {
  _id?: Types.ObjectId | string;
  menuItem: Types.ObjectId | string;
  quantity: number;
}

export interface OrderCreatedEvent {
  orderId: string;
  items: OrderCreatedEventItem[];
}

export const ORDER_CREATED = "order.created" as const;

class OrderEventEmitter extends EventEmitter {}

export const orderEventEmitter = new OrderEventEmitter();

// A subscriber's own failure must never take down the process. The default
// EventEmitter behaviour of throwing on an unhandled "error" event is therefore
// neutralised with a logging-only listener.
orderEventEmitter.on("error", (error: unknown) => {
  console.error("orderEventEmitter error:", error);
});

/**
 * Infer a production line for a menu item. MenuItems carry no explicit station,
 * so we derive one from name/category keywords and fall back to the cold/prep
 * line — the safe default that never starves a hot station of capacity.
 */
const STATION_KEYWORDS: ReadonlyArray<[KdsStation, RegExp]> = [
  ["grill", /grill|steak|burger|bbq|kebab|skewer|chop|roast/i],
  ["fry", /fry|fried|fries|tempura|wing|nugget|crispy|katsu/i],
  ["pantry", /salad|dessert|drink|beverage|juice|cold|ice cream|smoothie/i],
];

function inferStation(name: string, categoryName: string): KdsStation {
  const haystack = `${name} ${categoryName}`;
  for (const [station, pattern] of STATION_KEYWORDS) {
    if (pattern.test(haystack)) return station;
  }
  return "prep";
}

/**
 * Resolve KDS pacing inputs for an order's items: per-item name, cook time
 * (MenuItem.preparationTime), and inferred station. One batched query feeds the
 * whole ticket so paving stays cheap.
 */
async function buildPaceItems(
  items: OrderCreatedEventItem[],
): Promise<PaceItemInput[]> {
  const menuItemIds = items.map((item) => String(item.menuItem));
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } })
    .populate<{ category: { name?: string } | null }>("category", "name")
    .lean();

  const byId = new Map(menuItems.map((mi) => [String(mi._id), mi]));

  const paceItems: PaceItemInput[] = [];
  for (const item of items) {
    const menuItem = byId.get(String(item.menuItem));
    if (!menuItem) continue; // Item's menu record was removed; skip rather than fail the ticket.

    const categoryName =
      (menuItem.category as { name?: string } | null)?.name ?? "";

    paceItems.push({
      itemId: item._id ? String(item._id) : new Types.ObjectId().toString(),
      name: menuItem.name,
      station: inferStation(menuItem.name, categoryName),
      cookTimeMinutes: menuItem.preparationTime ?? 15,
    });
  }
  return paceItems;
}

orderEventEmitter.on(ORDER_CREATED, (payload: OrderCreatedEvent) => {
  // Fire-and-forget: never await this from the order flow.
  void (async () => {
    try {
      const items = await buildPaceItems(payload.items ?? []);
      if (items.length === 0) return;

      const kdsPacingService =
        DependencyContainer.getInstance().resolve<KdsPacingService>(
          "KdsPacingService",
        );
      await kdsPacingService.paveTicket(payload.orderId, items);
    } catch (error) {
      // Swallow: a KDS paving failure is operationally recoverable (the pacing
      // job and manual re-pave exist) and must not crash the server.
      console.error(
        `Failed to pave KDS ticket for order ${payload?.orderId}:`,
        error,
      );
    }
  })();
});
