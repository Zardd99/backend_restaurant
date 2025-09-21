  import { Request, Response } from "express";
  import Order from "../models/Order";
  import Receipt from "../models/Receipt";

  /**
   * Generate a unique receipt number
   */
  const generateReceiptNumber = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `RCP-${timestamp}-${random}`;
  };

  /**
   * POST /api/receipts
   * Create a new receipt for an order
   */
  export const createReceipt = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { orderId, paymentMethod, discount = 0 } = req.body;

      // Validate order exists
      const order = await Order.findById(orderId)
        .populate("customer", "name email")
        .populate("items.menuItem", "name price");

      if (!order) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      // Check if receipt already exists for this order
      const existingReceipt = await Receipt.findOne({ order: orderId });
      if (existingReceipt) {
        res
          .status(400)
          .json({ message: "Receipt already exists for this order" });
        return;
      }

      // Calculate tax
      const taxRate = 0.1;
      const subtotal = order.totalAmount;
      const tax = subtotal * taxRate;
      const totalAmount = subtotal + tax - discount;

      // Prepare receipt items
      const receiptItems = order.items.map((item) => ({
        name: (item.menuItem as any).name,
        quantity: item.quantity,
        price: item.price,
      }));

      // Create receipt
      const receipt = new Receipt({
        order: orderId,
        receiptNumber: generateReceiptNumber(),
        paymentMethod,
        subtotal,
        tax,
        discount,
        totalAmount,
        customer: order.customer._id,
        items: receiptItems,
      });

      const savedReceipt = await receipt.save();
      await savedReceipt.populate("customer", "name email");
      await savedReceipt.populate("order");

      res.status(201).json(savedReceipt);
    } catch (error) {
      res.status(400).json({ message: "Error creating receipt", error });
    }
  };

  /**
   * GET /api/receipts
   * Retrieve all receipts with optional filtering
   */
  export const getAllReceipts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {
        paymentMethod,
        paymentStatus,
        startDate,
        endDate,
        minAmount,
        maxAmount,
      } = req.query;
      const filter: any = {};

      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (paymentStatus) filter.paymentStatus = paymentStatus;

      // Date range filtering
      if (startDate || endDate) {
        filter.issuedAt = {};
        if (startDate) filter.issuedAt.$gte = new Date(startDate as string);
        if (endDate) filter.issuedAt.$lte = new Date(endDate as string);
      }

      // Amount filtering
      if (minAmount || maxAmount) {
        filter.totalAmount = {};
        if (minAmount) filter.totalAmount.$gte = Number(minAmount);
        if (maxAmount) filter.totalAmount.$lte = Number(maxAmount);
      }

      const receipts = await Receipt.find(filter)
        .populate("customer", "name email")
        .populate("order")
        .sort({ issuedAt: -1 });

      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  };

  /**
   * GET /api/receipts/:id
   * Get a specific receipt by ID
   */
  export const getReceiptById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const receipt = await Receipt.findById(req.params.id)
        .populate("customer", "name email phone")
        .populate("order")
        .populate("items.menuItem", "name description");

      if (!receipt) {
        res.status(404).json({ message: "Receipt not found" });
        return;
      }

      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  };

  /**
   * GET /api/receipts/order/:orderId
   * Get receipt by order ID
   */
  export const getReceiptByOrderId = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const receipt = await Receipt.findOne({ order: req.params.orderId })
        .populate("customer", "name email phone")
        .populate("order")
        .populate("items.menuItem", "name description");

      if (!receipt) {
        res.status(404).json({ message: "Receipt not found for this order" });
        return;
      }

      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  };

  /**
   * PUT /api/receipts/:id
   * Update a receipt (primarily for payment status updates)
   */
  export const updateReceipt = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { paymentStatus, discount } = req.body;

      const updateData: any = {};
      if (paymentStatus) updateData.paymentStatus = paymentStatus;
      if (discount !== undefined) updateData.discount = discount;

      // Recalculate total if discount changed
      if (discount !== undefined) {
        const receipt = await Receipt.findById(req.params.id);
        if (receipt) {
          updateData.totalAmount = receipt.subtotal + receipt.tax - discount;
        }
      }

      const updatedReceipt = await Receipt.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate("customer", "name email")
        .populate("order");

      if (!updatedReceipt) {
        res.status(404).json({ message: "Receipt not found" });
        return;
      }

      res.json(updatedReceipt);
    } catch (error) {
      res.status(400).json({ message: "Error updating receipt", error });
    }
  };
