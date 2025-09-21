import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import Order from "@/app/models/Order";
import connectDB from "../../../config/db";

interface MongoValidationError extends Error {
  errors?: { [path: string]: { message: string } };
  code?: number;
  name: string;
}

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "cancelled",
];

/**
 * GET /api/orders/[id]
 * Retrieve a single order by ID with populated customer and menuItem data
 *
 * @param request - NextRequest object
 * @param params - Object containing route parameters { id: string }
 *
 * @returns NextResponse with order data or error message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findById(params.id)
      .populate("customer", "name email phone")
      .populate("items.menuItem", "name price description");

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error in GET /api/orders/[id]:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
        error: process.env.NODE_ENV === "development" ? error : {},
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]
 * Update an existing order by ID (full update)
 *
 * @param request - NextRequest object with JSON body
 * @param params - Object containing route parameters { id: string }
 *
 * Request Body: Complete order data
 * - customer: string (ObjectId)
 * - items: Array of { menuItem: string, quantity: number, specialInstructions: string }
 * - orderType: 'dine-in' | 'takeaway' | 'delivery'
 * - status: string (from VALID_STATUSES)
 * - totalAmount: number
 * - orderDate: Date
 *
 * @returns NextResponse with updated order data or error message
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid status value. Valid statuses are: " +
            VALID_STATUSES.join(", "),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const existingOrder = await Order.findById(params.id);
    if (!existingOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    const updatedOrder = await Order.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error: unknown) {
    console.error("Error in PUT /api/orders/[id]:", error);

    const mongoError = error as MongoValidationError;
    if (mongoError.name === "ValidationError") {
      const validationErrors = mongoError.errors
        ? Object.values(mongoError.errors).map((err) => err.message)
        : ["Validation failed"];

      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
        error: process.env.NODE_ENV === "development" ? mongoError : {},
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]
 * Partially update an order by ID (specific fields only)
 *
 * @param request - NextRequest object with JSON body
 * @param params - Object containing route parameters { id: string }
 *
 * Request Body: Partial update fields
 * - status: string (from VALID_STATUSES) - optional
 * - items: Array - optional
 * - specialInstructions: string - optional
 * - orderType: string - optional
 *
 * @returns NextResponse with updated order data or error message
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid status value. Valid statuses are: " +
            VALID_STATUSES.join(", "),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const existingOrder = await Order.findById(params.id);
    if (!existingOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    const updatedOrder = await Order.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/orders/[id]:", error);

    const mongoError = error as MongoValidationError;
    if (mongoError.name === "ValidationError") {
      const validationErrors = mongoError.errors
        ? Object.values(mongoError.errors).map((err) => err.message)
        : ["Validation failed"];

      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
        error: process.env.NODE_ENV === "development" ? mongoError : {},
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order by ID
 *
 * @param request - NextRequest object
 * @param params - Object containing route parameters { id: string }
 *
 * @returns NextResponse with deletion confirmation or error message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedOrder = await Order.findByIdAndDelete(params.id)
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!deletedOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order deleted successfully",
      data: deletedOrder,
    });
  } catch (error) {
    console.error("Error in DELETE /api/orders/[id]:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
        error: process.env.NODE_ENV === "development" ? error : {},
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]/status
 * Update only the status of an order
 *
 * @param request - NextRequest object with JSON body
 * @param params - Object containing route parameters { id: string }
 *
 * Request Body:
 * - status: string (required, from VALID_STATUSES)
 *
 * @returns NextResponse with updated order data or error message
 */
export async function PATCH_STATUS(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          message: "Status field is required",
        },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid status value. Valid statuses are: " +
            VALID_STATUSES.join(", "),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const updatedOrder = await Order.findByIdAndUpdate(
      params.id,
      { status },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/orders/[id]/status:", error);

    const mongoError = error as MongoValidationError;
    if (mongoError.name === "ValidationError") {
      const validationErrors = mongoError.errors
        ? Object.values(mongoError.errors).map((err) => err.message)
        : ["Validation failed"];

      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Server Error",
        error: process.env.NODE_ENV === "development" ? mongoError : {},
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Method not allowed. Use PUT for full updates or PATCH for partial updates.",
    },
    { status: 405 }
  );
}
