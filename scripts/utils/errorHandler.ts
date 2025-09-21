import { MongoError, ValidationError } from "../types";

export interface BulkWriteError extends Error {
  result?: any;
  writeErrors?: any[];
}

// Add this type guard
export function isBulkWriteError(error: unknown): error is BulkWriteError {
  return error instanceof Error && "result" in error;
}

export function isMongoError(error: unknown): error is MongoError {
  return error instanceof Error && "code" in error;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && "errors" in error;
}

export function handleError(error: unknown): void {
  console.error("An error occurred:");

  if (error instanceof Error) {
    console.error(`Message: ${error.message}`);
  } else {
    console.error("Unknown error type:", error);
    return;
  }

  // Handle bulk write errors
  if (isBulkWriteError(error) && error.writeErrors) {
    console.error("Bulk write errors:");
    error.writeErrors.forEach((writeError, index) => {
      console.error(`- Error ${index + 1}: ${writeError.errmsg}`);
    });

    if (error.result && error.result.insertedCount > 0) {
      console.error(
        `Successfully inserted ${error.result.insertedCount} documents`
      );
    }
  }

  // Handle specific MongoDB errors
  if (isMongoError(error)) {
    if (error.code === 11000) {
      console.error("Duplicate key error:", error.keyValue);
    } else {
      console.error("MongoDB error code:", error.code);
    }
  }

  // Handle validation errors
  if (isValidationError(error) && error.errors) {
    console.error("Validation errors:");
    Object.keys(error.errors).forEach((key) => {
      console.error(`- ${key}: ${error.errors![key].message}`);
    });
  }

  // Log stack trace in debug mode
  if (process.env.DEBUG === "true" && error instanceof Error) {
    console.error("Stack trace:", error.stack);
  }
}
