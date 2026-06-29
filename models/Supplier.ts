import mongoose, { Document, Schema, Types } from "mongoose";

export type ObjectIdType = mongoose.Types.ObjectId;

export interface ISupplier extends Document {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  suppliedIngredients: ObjectIdType[];
  paymentTerms: string;
  minimumOrderValue: number;
  leadTimeDays: number;
  isActive: boolean;
  notes?: string;
}

const supplierSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    suppliedIngredients: [{ type: Schema.Types.ObjectId, ref: "Ingredient" }],
    paymentTerms: { type: String, default: "Net 30" },
    minimumOrderValue: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 3, min: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true },
);

// Ingredient Schema (for inventory tracking)
export type StorageRequirement = "ambient" | "chilled" | "frozen";

export interface IIngredient extends Document {
  name: string;
  description: string;
  unit: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
  costPerUnit: number;
  supplier: ObjectIdType;
  category: string;
  shelfLife?: number;
  // In-house prepped item (e.g. stock, sauce) produced via a Recipe rather than
  // purchased raw. `recipeId` points at its bill of materials when isPrepped.
  isPrepped: boolean;
  recipeId?: ObjectIdType | null;
  storageRequirement: StorageRequirement;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ingredientSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    unit: { type: String, required: true },
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number, required: true },
    reorderPoint: { type: Number, required: true },
    costPerUnit: { type: Number, required: true },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    category: { type: String, required: true },
    shelfLife: { type: Number },
    isPrepped: { type: Boolean, default: false, index: true },
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", default: null },
    storageRequirement: {
      type: String,
      enum: ["ambient", "chilled", "frozen"],
      default: "ambient",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Purchase Order Schema
//
// `receivedQuantity` per item + the draft/partially_received/received statuses
// support the IMS goods-receiving workflow (see
// services/inventory_management_service). `poNumber` is an alias of the legacy
// `orderNumber` so new code can use the spec field name with no data migration.
export type PurchaseOrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "delivered"
  | "cancelled";

export interface IPurchaseOrderItem {
  ingredient: Types.ObjectId;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface IPurchaseOrder extends Document {
  orderNumber: string;
  poNumber: string; // alias of orderNumber
  supplier: Types.ObjectId;
  items: IPurchaseOrderItem[];
  totalAmount: number;
  orderDate: Date;
  expectedDelivery: Date;
  actualDelivery?: Date;
  receivedAt?: Date;
  status: PurchaseOrderStatus;
  notes?: string;
  createdBy: Types.ObjectId; // Reference to User who created the order
}

const purchaseOrderSchema: Schema = new Schema(
  {
    orderNumber: { type: String, required: true, alias: "poNumber" },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: [
      {
        ingredient: {
          type: Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        quantity: { type: Number, required: true, min: 0 },
        receivedQuantity: { type: Number, default: 0, min: 0 },
        unitCost: { type: Number, required: true, min: 0 },
        totalCost: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDelivery: { type: Date, required: true },
    actualDelivery: { type: Date },
    receivedAt: { type: Date },
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "approved",
        "ordered",
        "partially_received",
        "received",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  },
);

// Stock Adjustment Schema (for manual stock corrections)
export interface IStockAdjustment extends Document {
  ingredient: Types.ObjectId;
  adjustmentType: "add" | "remove" | "set";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  adjustedBy: Types.ObjectId; // Reference to User
  notes?: string;
}

const stockAdjustmentSchema: Schema = new Schema(
  {
    ingredient: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    adjustmentType: {
      type: String,
      enum: ["add", "remove", "set"],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, required: true },
    adjustedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String },
  },
  {
    timestamps: true,
  },
);

// Low Stock Notification Schema
export interface ILowStockNotification extends Document {
  ingredient: Types.ObjectId;
  currentStock: number;
  minStock: number;
  notifiedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: Types.ObjectId; // Reference to User
  acknowledgedAt?: Date;
}

const lowStockNotificationSchema: Schema = new Schema(
  {
    ingredient: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    currentStock: { type: Number, required: true },
    minStock: { type: Number, required: true },
    notifiedAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
ingredientSchema.index({ currentStock: 1, minStock: 1 }); // For low stock queries
ingredientSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });
purchaseOrderSchema.index({ orderNumber: 1 });
lowStockNotificationSchema.index({ acknowledged: 1, ingredient: 1 });

// Export models
export const Supplier = mongoose.model<ISupplier>("Supplier", supplierSchema);
export const Ingredient = mongoose.model<IIngredient>(
  "Ingredient",
  ingredientSchema,
);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema,
);
export const StockAdjustment = mongoose.model<IStockAdjustment>(
  "StockAdjustment",
  stockAdjustmentSchema,
);
export const LowStockNotification = mongoose.model<ILowStockNotification>(
  "LowStockNotification",
  lowStockNotificationSchema,
);

export const toPlainObject = <T>(doc: any): T => {
  return doc?.toObject?.() || doc;
};
