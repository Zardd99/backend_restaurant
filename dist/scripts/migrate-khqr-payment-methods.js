"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function migrate() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not set");
    }
    console.log("Connecting to MongoDB...");
    await mongoose_1.default.connect(uri);
    const orders = mongoose_1.default.connection.collection("orders");
    const topLevelMatched = await orders.countDocuments({ paymentMethod: "KHQR" });
    const topLevel = await orders.updateMany({ paymentMethod: "KHQR" }, { $set: { paymentMethod: "khqr" } });
    console.log(`paymentMethod: matched ${topLevelMatched}, modified ${topLevel.modifiedCount}`);
    const splitMatched = await orders.countDocuments({
        "splitDetails.method": "KHQR",
    });
    const split = await orders.updateMany({ "splitDetails.method": "KHQR" }, { $set: { "splitDetails.$[el].method": "khqr" } }, { arrayFilters: [{ "el.method": "KHQR" }] });
    console.log(`splitDetails.method: matched ${splitMatched}, modified ${split.modifiedCount}`);
    const remaining = await orders.countDocuments({
        $or: [{ paymentMethod: "KHQR" }, { "splitDetails.method": "KHQR" }],
    });
    console.log(`Remaining legacy "KHQR" values: ${remaining}`);
    await mongoose_1.default.disconnect();
    console.log("Migration complete.");
}
migrate().catch(async (error) => {
    console.error("Migration failed:", error);
    await mongoose_1.default.disconnect().catch(() => undefined);
    process.exit(1);
});
//# sourceMappingURL=migrate-khqr-payment-methods.js.map