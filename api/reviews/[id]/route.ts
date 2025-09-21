import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import Review from "@/app/models/Review";
import connectDB from "../../../config/db";

interface MongoValidationError extends Error {
  errors?: { [path: string]: { message: string } };
  code?: number;
  name: string;
}

/**
 * GET /api/reviews/[id]
 * Retrieve a single review by ID with populated user and menuItem data
 *
 * @param request - NextRequest object
 * @param params - Object containing route parameters { id: string }
 *
 * @returns NextResponse with review data or error message
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
          message: "Invalid review ID format",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const review = await Review.findById(params.id)
      .populate("user", "name email")
      .populate("menuItem", "name price category description");

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("Error in GET /api/reviews/[id]:", error);

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
 * PUT /api/reviews/[id]
 * Update an existing review by ID
 *
 * @param request - NextRequest object with JSON body
 * @param params - Object containing route parameters { id: string }
 *
 * Request Body:
 * - rating: number (optional, 1-5)
 * - comment: string (optional)
 *
 * @returns NextResponse with updated review data or error message
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
          message: "Invalid review ID format",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { rating, comment } = body;

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        {
          success: false,
          message: "Rating must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const existingReview = await Review.findById(params.id);
    if (!existingReview) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (rating !== undefined) updateData.rating = Number(rating);
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(
      params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    if (!updatedReview) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error: unknown) {
    console.error("Error in PUT /api/reviews/[id]:", error);

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
 * DELETE /api/reviews/[id]
 * Delete a review by ID
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
          message: "Invalid review ID format",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedReview = await Review.findByIdAndDelete(params.id)
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    if (!deletedReview) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully",
      data: deletedReview,
    });
  } catch (error) {
    console.error("Error in DELETE /api/reviews/[id]:", error);

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
 * PATCH /api/reviews/[id]
 * Partially update a review by ID (alternative to PUT)
 *
 * @param request - NextRequest object with JSON body
 * @param params - Object containing route parameters { id: string }
 *
 * Request Body: Partial update fields
 * - rating: number (optional, 1-5)
 * - comment: string (optional)
 *
 * @returns NextResponse with updated review data or error message
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
          message: "Invalid review ID format",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { rating, comment } = body;

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        {
          success: false,
          message: "Rating must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const existingReview = await Review.findById(params.id);
    if (!existingReview) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (rating !== undefined) updateData.rating = Number(rating);
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(
      params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    if (!updatedReview) {
      return NextResponse.json(
        {
          success: false,
          message: "Review not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/reviews/[id]:", error);

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
        "Method not allowed. Use PUT to update or PATCH for partial updates.",
    },
    { status: 405 }
  );
}
