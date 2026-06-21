"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Order_1 = __importDefault(require("../models/Order"));
const Receipt_1 = __importDefault(require("../models/Receipt"));
dotenv_1.default.config();
const generateReceiptNumber = () => {
    const ts = Date.now().toString();
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `RCP-${ts}-${rand}`;
};
async function backfill() {
    var _a, _b, _c, _d;
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI is not set in .env");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri);
    console.log("Connected to MongoDB");
    const paidOrders = await Order_1.default.find({ paymentStatus: "paid" })
        .populate("items.menuItem", "name")
        .lean();
    console.log(`Found ${paidOrders.length} paid order(s)`);
    let created = 0;
    let skipped = 0;
    for (const order of paidOrders) {
        const exists = await Receipt_1.default.findOne({ order: order._id });
        if (exists) {
            skipped++;
            continue;
        }
        const discount = (_a = order.totalDiscountAmount) !== null && _a !== void 0 ? _a : 0;
        const subtotal = order.totalAmount + discount;
        const items = order.items.map((item) => {
            var _a, _b, _c, _d, _e;
            return ({
                menuItem: (_b = (_a = item.menuItem) === null || _a === void 0 ? void 0 : _a._id) !== null && _b !== void 0 ? _b : item.menuItem,
                name: (_d = (_c = item.menuItem) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : "Item",
                quantity: item.quantity,
                price: (_e = item.finalPrice) !== null && _e !== void 0 ? _e : item.price,
            });
        });
        await Receipt_1.default.create({
            order: order._id,
            receiptNumber: generateReceiptNumber(),
            paymentMethod: (_b = order.paymentMethod) !== null && _b !== void 0 ? _b : "cash",
            paymentStatus: "completed",
            subtotal,
            tax: 0,
            discount,
            totalAmount: order.totalAmount,
            issuedAt: (_c = order.paidAt) !== null && _c !== void 0 ? _c : order.updatedAt,
            items,
        });
        created++;
        console.log(`  Created receipt for order ${order._id} (${order.tableNumber ? `Table ${order.tableNumber}` : (_d = order.customerName) !== null && _d !== void 0 ? _d : "Takeaway"})`);
    }
    console.log(`\nDone — created: ${created}, already existed: ${skipped}`);
    await mongoose_1.default.disconnect();
}
backfill().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=backfill-receipts.js.map