/**
 * Canonical import path for the Purchase Order (and Supplier) models.
 *
 * The Mongoose models are registered in `./Supplier` (where they have lived
 * since before the IMS work). Re-exporting them here gives the spec-requested
 * `models/PurchaseOrder.ts` entry point WITHOUT re-registering the schema —
 * registering "PurchaseOrder"/"Supplier" twice throws Mongoose's
 * OverwriteModelError. Prefer importing from this module in new code.
 */
export {
  PurchaseOrder,
  Supplier,
  type IPurchaseOrder,
  type IPurchaseOrderItem,
  type PurchaseOrderStatus,
  type ISupplier,
} from "./Supplier";

export { PurchaseOrder as default } from "./Supplier";
