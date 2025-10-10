"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReceiptUpdate = void 0;
const validateReceiptUpdate = (data) => {
    const errors = [];
    if (data.paymentMethod &&
        !["cash", "credit_card", "debit_card", "online"].includes(data.paymentMethod)) {
        errors.push("Invalid payment method");
    }
    if (data.paymentStatus &&
        !["pending", "completed", "failed", "refunded"].includes(data.paymentStatus)) {
        errors.push("Invalid payment status");
    }
    if (data.discount !== undefined &&
        (typeof data.discount !== "number" || data.discount < 0)) {
        errors.push("Discount must be a positive number");
    }
    return errors;
};
exports.validateReceiptUpdate = validateReceiptUpdate;
//# sourceMappingURL=validation.js.map