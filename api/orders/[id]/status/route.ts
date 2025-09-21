import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import Order from "@/app/models/Order";
import connectDB from "../../../../config/db";

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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`PATCH /api/orders/${params.id}/status called`);

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

    console.log(`Updating order ${params.id} status to: ${status}`);

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
          message: `Invalid status value. Valid statuses are: ${VALID_STATUSES.join(
            ", "
          )}`,
          validStatuses: VALID_STATUSES,
        },
        { status: 400 }
      );
    }

    await connectDB();

    // First check if the order exists
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

    console.log(
      `Order found. Current status: ${existingOrder.status}, New status: ${status}`
    );

    // Update the order status
    const updatedOrder = await Order.findByIdAndUpdate(
      params.id,
      {
        status,
        updatedAt: new Date(),
      },
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
          message: "Failed to update order",
        },
        { status: 500 }
      );
    }

    console.log(`Order ${params.id} status updated successfully to: ${status}`);

    return NextResponse.json(
      {
        success: true,
        message: "Order status updated successfully",
        data: updatedOrder,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:3000",
          "Access-Control-Allow-Methods": "PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
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
        error:
          process.env.NODE_ENV === "development"
            ? String(mongoError)
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "Method not allowed. Use PATCH to update order status.",
    },
    { status: 405 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "Method not allowed. Use PATCH to update order status.",
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      message: "Method not allowed. Use PATCH to update order status.",
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      message: "Method not allowed. Use PATCH to update order status.",
    },
    { status: 405 }
  );
}
