import mongoose, { Document, Schema, Types } from "mongoose";

export interface IReview extends Document {
  user: Types.ObjectId;
  menuItem: Types.ObjectId;
  rating: number;
  comment: string;
  date: Date;
}

const reviewSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  date: { type: Date, default: Date.now },
});

reviewSchema.index({ user: 1, menuItem: 1 }, { unique: true });

// Update
reviewSchema.post("save", async function () {
  const MenuItem = mongoose.model("MenuItem");
  const reviews = await mongoose
    .model("Review")
    .find({ menuItem: this.menuItem });

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;
  const reviewCount = reviews.length;

  await MenuItem.findByIdAndUpdate(this.menuItem, {
    averageRating: parseFloat(averageRating.toFixed(1)),
    reviewCount,
  });
});

export default mongoose.model<IReview>("Review", reviewSchema);
