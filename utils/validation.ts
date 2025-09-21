/**
 * Interface for receipt update data
 */
interface ReceiptUpdateData {
  paymentMethod?: string;
  paymentStatus?: string;
  discount?: number;
}

/**
 * Validate receipt update data
 */
export const validateReceiptUpdate = (data: ReceiptUpdateData): string[] => {
  const errors: string[] = [];

  if (
    data.paymentMethod &&
    !["cash", "credit_card", "debit_card", "online"].includes(
      data.paymentMethod
    )
  ) {
    errors.push("Invalid payment method");
  }

  if (
    data.paymentStatus &&
    !["pending", "completed", "failed", "refunded"].includes(data.paymentStatus)
  ) {
    errors.push("Invalid payment status");
  }

  if (
    data.discount !== undefined &&
    (typeof data.discount !== "number" || data.discount < 0)
  ) {
    errors.push("Discount must be a positive number");
  }

  return errors;
};
