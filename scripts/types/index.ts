import mongoose from "mongoose";

export interface MongoError extends Error {
  code?: number;
  errmsg?: string;
  keyValue?: Record<string, any>;
}

export interface ValidationError extends Error {
  errors?: {
    [path: string]: mongoose.Error.ValidatorError | mongoose.Error.CastError;
  };
}

export interface IngredientReference {
  ingredient: mongoose.Types.ObjectId;
  quantity: number;
}

export interface MenuItemData {
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

export interface OperationResult {
  success: boolean;
  message: string;
  data?: any; // Changed from string to any to accommodate different data types
  error?: Error;
}
