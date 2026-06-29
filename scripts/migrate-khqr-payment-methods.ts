/**
 * Normalize legacy "KHQR" payment-method values to "khqr" on Order documents.
 *
 * Idempotent and index-safe: operates on the raw `orders` collection with
 * targeted updateMany filters (no full-document rewrites, no validator runs),
 * so it touches only the affected fields and leaves indexes intact.
 *
 * Usage: npx ts-node scripts/migrate-khqr-payment-methods.ts
 * Requires MONGODB_URI in the environment (.env).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function migrate(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  const orders = mongoose.connection.collection("orders");

  // 1) Top-level paymentMethod: "KHQR" -> "khqr"
  const topLevelMatched = await orders.countDocuments({ paymentMethod: "KHQR" });
  const topLevel = await orders.updateMany(
    { paymentMethod: "KHQR" },
    { $set: { paymentMethod: "khqr" } },
  );
  console.log(
    `paymentMethod: matched ${topLevelMatched}, modified ${topLevel.modifiedCount}`,
  );

  // 2) Nested splitDetails[].method: "KHQR" -> "khqr"
  const splitMatched = await orders.countDocuments({
    "splitDetails.method": "KHQR",
  });
  const split = await orders.updateMany(
    { "splitDetails.method": "KHQR" },
    { $set: { "splitDetails.$[el].method": "khqr" } },
    { arrayFilters: [{ "el.method": "KHQR" }] },
  );
  console.log(
    `splitDetails.method: matched ${splitMatched}, modified ${split.modifiedCount}`,
  );

  // 3) Verify no legacy values remain.
  const remaining = await orders.countDocuments({
    $or: [{ paymentMethod: "KHQR" }, { "splitDetails.method": "KHQR" }],
  });
  console.log(`Remaining legacy "KHQR" values: ${remaining}`);

  await mongoose.disconnect();
  console.log("Migration complete.");
}

migrate().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
