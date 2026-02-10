const mongoose = require("mongoose");
require("dotenv").config();

const migratePromotionFields = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const Order = mongoose.model("Order");

    // Add new fields to existing orders (set defaults)
    await Order.updateMany(
      {},
      {
        $set: {
          "items.$[].originalPrice": { $ifNull: ["$items.$[].price", 0] },
          "items.$[].appliedPromotionId": null,
          "items.$[].discountAmount": 0,
          "items.$[].finalPrice": { $ifNull: ["$items.$[].price", 0] },
          orderDiscountAmount: 0,
        },
      },
      { multi: true },
    );

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migratePromotionFields();
