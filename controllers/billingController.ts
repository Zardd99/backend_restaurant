import { Request, Response } from "express";
import Order from "../models/Order";
import Receipt from "../models/Receipt";
import { AuthRequest } from "../middleware/auth";

const PAYMENT_METHODS = ["cash", "credit_card", "debit_card", "KHQR"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const getServedOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { paymentStatus } = req.query;

    const filter: Record<string, unknown> = { status: "served" };
    if (paymentStatus === "unpaid" || paymentStatus === "paid") {
      filter.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(filter)
      .populate("items.menuItem", "name category")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, orders });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch served orders" });
  }
};

export const processPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body as { paymentMethod: PaymentMethod };

    if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
      res.status(400).json({
        success: false,
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
      });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    if (order.status !== "served") {
      res.status(400).json({
        success: false,
        message: "Only served orders can be processed for payment",
      });
      return;
    }
    if (order.paymentStatus === "paid") {
      res.status(400).json({ success: false, message: "Order is already paid" });
      return;
    }

    order.paymentStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    await order.save();

    const existingReceipt = await Receipt.findOne({ order: id });
    if (!existingReceipt) {
      const populatedOrder = await Order.findById(id).populate("items.menuItem", "name");
      if (populatedOrder) {
        const discount = populatedOrder.totalDiscountAmount ?? 0;
        const subtotal = populatedOrder.totalAmount + discount;
        const receiptItems = populatedOrder.items.map((item: any) => ({
          menuItem: item.menuItem?._id ?? item.menuItem,
          name: item.menuItem?.name ?? "Item",
          quantity: item.quantity,
          price: item.finalPrice ?? item.price,
        }));
        const ts = Date.now().toString();
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        await Receipt.create({
          order: id,
          receiptNumber: `RCP-${ts}-${rand}`,
          paymentMethod,
          paymentStatus: "completed",
          subtotal,
          tax: 0,
          discount,
          totalAmount: populatedOrder.totalAmount,
          items: receiptItems,
        });
      }
    }

    req.app.get("io").emit("billing:payment_updated", {
      orderId: id,
      paymentStatus: "paid",
      paymentMethod,
      tableNumber: order.tableNumber,
      totalAmount: order.totalAmount,
    });

    res.json({ success: true, order });
  } catch {
    res.status(500).json({ success: false, message: "Failed to process payment" });
  }
};
