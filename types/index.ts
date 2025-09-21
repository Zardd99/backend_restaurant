import mongoose, { Document, Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "customer" | "admin" | "staff";
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ICategory extends Document {
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngredientReference {
  ingredient: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IMenuItem extends Document {
  name: string;
  description: string;
  price: number;
  category: mongoose.Types.ObjectId;
  image: string; // Changed from imageUrl to image
  ingredientReferences: IngredientReference[]; // Replaced ingredients with ingredientReferences
  dietaryTags: string[];
  availability: boolean; // Changed from isAvailable to availability
  preparationTime: number;
  chefSpecial?: boolean;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface IReview extends Document {
  user: Types.ObjectId;
  menuItem: Types.ObjectId;
  rating: number;
  comment: string;
  date: Date;
}

export interface IPriceHistory extends Document {
  menuItem: Types.ObjectId;
  oldPrice: number;
  newPrice: number;
  changedBy: Types.ObjectId;
  changeDate: Date;
}

export interface IOrderItem {
  menuItem: Types.ObjectId;
  quantity: number;
  specialInstructions: string;
  price: number;
}

export interface IOrder extends Document {
  items: IOrderItem[];
  totalAmount: number;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "served"
    | "cancelled";
  customer: Types.ObjectId;
  tableNumber?: number;
  orderType: "dine-in" | "takeaway" | "delivery";
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
