"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOperation = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
class BaseOperation {
    constructor(operationName) {
        this.logger = new logger_1.Logger(operationName);
    }
    async executeOperation(operation) {
        try {
            await (0, db_1.connectDB)();
            this.logger.info("Starting operation...");
            const result = await operation();
            this.logger.info("Operation completed successfully");
            return result;
        }
        catch (error) {
            (0, errorHandler_1.handleError)(error);
            throw error;
        }
        finally {
            await (0, db_1.disconnectDB)();
        }
    }
    loadData(data, defaultData) {
        if (data) {
            try {
                return JSON.parse(data);
            }
            catch (error) {
                throw new Error("Invalid JSON data provided");
            }
        }
        return defaultData;
    }
    async loadDataFromFile(filePath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        try {
            const data = await fs.readFile(filePath, "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            throw new Error(`Error reading file ${filePath}: ${error}`);
        }
    }
}
exports.BaseOperation = BaseOperation;
//# sourceMappingURL=baseOperation.js.map