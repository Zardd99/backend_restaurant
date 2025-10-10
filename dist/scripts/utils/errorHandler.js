"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBulkWriteError = isBulkWriteError;
exports.isMongoError = isMongoError;
exports.isValidationError = isValidationError;
exports.handleError = handleError;
function isBulkWriteError(error) {
    return error instanceof Error && "result" in error;
}
function isMongoError(error) {
    return error instanceof Error && "code" in error;
}
function isValidationError(error) {
    return error instanceof Error && "errors" in error;
}
function handleError(error) {
    console.error("An error occurred:");
    if (error instanceof Error) {
        console.error(`Message: ${error.message}`);
    }
    else {
        console.error("Unknown error type:", error);
        return;
    }
    if (isBulkWriteError(error) && error.writeErrors) {
        console.error("Bulk write errors:");
        error.writeErrors.forEach((writeError, index) => {
            console.error(`- Error ${index + 1}: ${writeError.errmsg}`);
        });
        if (error.result && error.result.insertedCount > 0) {
            console.error(`Successfully inserted ${error.result.insertedCount} documents`);
        }
    }
    if (isMongoError(error)) {
        if (error.code === 11000) {
            console.error("Duplicate key error:", error.keyValue);
        }
        else {
            console.error("MongoDB error code:", error.code);
        }
    }
    if (isValidationError(error) && error.errors) {
        console.error("Validation errors:");
        Object.keys(error.errors).forEach((key) => {
            console.error(`- ${key}: ${error.errors[key].message}`);
        });
    }
    if (process.env.DEBUG === "true" && error instanceof Error) {
        console.error("Stack trace:", error.stack);
    }
}
//# sourceMappingURL=errorHandler.js.map