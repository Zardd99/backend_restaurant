import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order";
import Receipt from "../models/Receipt";

dotenv.config();

const generateReceiptNumber = () => {
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `RCP-${ts}-${rand}`;
};

async function backfill() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const paidOrders = await Order.find({ paymentStatus: "paid" })
    .populate("items.menuItem", "name")
    .lean();

  console.log(`Found ${paidOrders.length} paid order(s)`);

  let created = 0;
  let skipped = 0;

  for (const order of paidOrders) {
    const exists = await Receipt.findOne({ order: order._id });
    if (exists) {
      skipped++;
      continue;
    }

    const discount = order.totalDiscountAmount ?? 0;
    const subtotal = order.totalAmount + discount;

    const items = order.items.map((item: any) => ({
      menuItem: item.menuItem?._id ?? item.menuItem,
      name: item.menuItem?.name ?? "Item",
      quantity: item.quantity,
      price: item.finalPrice ?? item.price,
    }));

    await Receipt.create({
      order: order._id,
      receiptNumber: generateReceiptNumber(),
      paymentMethod: order.paymentMethod ?? "cash",
      paymentStatus: "completed",
      subtotal,
      tax: 0,
      discount,
      totalAmount: order.totalAmount,
      issuedAt: order.paidAt ?? order.updatedAt,
      items,
    });

    created++;
    console.log(`  Created receipt for order ${order._id} (${order.tableNumber ? `Table ${order.tableNumber}` : order.customerName ?? "Takeaway"})`);
  }

  console.log(`\nDone — created: ${created}, already existed: ${skipped}`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
