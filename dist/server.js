"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = require("./server/index");
const db_1 = __importDefault(require("./config/db"));
const rateLimter_1 = __importDefault(require("./middleware/rateLimter"));
const dependencies_1 = require("./config/dependencies");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
(0, index_1.initWebSocketServer)(server);
const port = process.env.PORT || 5000;
(0, db_1.default)();
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        const allowedOrigins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://0.0.0.0:3000",
            "http://10.0.2.2:3000",
            "http://10.0.2.2:5000",
            "http://localhost:53597/",
            "http://localhost:53597",
            "http://localhost:51319/",
            "http://localhost:51319",
            ...(process.env.API_URL ? [process.env.API_URL] : []),
            ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
            ...(process.env.IP ? [process.env.IP] : []),
        ];
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else if (origin.match(/http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/) ||
            origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok\.io$/) ||
            origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app$/)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Accept-Language",
        "Accept-Encoding",
        "Cache-Control",
        "Connection",
        "Host",
        "Origin",
        "Referer",
        "User-Agent",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "X-Real-IP",
        "ngrok-skip-browser-warning",
        "X-Vercel-*",
        "X-API-Key",
        "X-Client-Version",
        "X-Device-Type",
        "X-CSRF-Token",
        "X-Frame-Options",
        "Pragma",
        "Expires",
        "If-Modified-Since",
        "If-None-Match",
    ],
    exposedHeaders: [
        "Authorization",
        "Content-Length",
        "X-Kuma-Revision",
        "Set-Cookie",
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use((0, rateLimter_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
console.log("Setting up dependencies...");
try {
    (0, dependencies_1.setupDependencies)();
}
catch (error) {
    console.error("Critical Failure: Dependency setup failed", error);
    process.exit(1);
}
const container = dependencies_1.DependencyContainer.getInstance();
let inventoryManager;
let emailService;
try {
    inventoryManager = container.resolve("InventoryManager");
    inventoryManager.startAutomaticAlerts();
}
catch (error) {
    console.warn("InventoryManager could not be initialized. Alerts will be disabled.");
}
try {
    OrderTimeoutService_1.orderTimeoutService.startTimeoutChecker();
    console.log("Order timeout checker started successfully");
}
catch (error) {
    console.warn("Order timeout checker could not be initialized:", error);
}
try {
    emailService = container.resolve("EmailService");
}
catch (error) {
    console.warn("EmailService could not be retrieved for shutdown.");
}
const orders_1 = __importDefault(require("./api/orders/orders"));
const menu_1 = __importDefault(require("./api/menu/menu"));
const reviews_1 = __importDefault(require("./api/reviews/reviews"));
const rating_1 = __importDefault(require("./api/reviews/rating/rating"));
const category_1 = __importDefault(require("./api/category/category"));
const priceHistory_1 = __importDefault(require("./api/priceHistory/priceHistory"));
const supplier_1 = __importDefault(require("./api/supplier/supplier"));
const receipts_1 = __importDefault(require("./api/receipts/receipts"));
const users_1 = __importDefault(require("./api/users/users"));
const auth_1 = __importDefault(require("./api/auth/auth"));
const inventory_router_1 = __importDefault(require("./api/inventory/inventory-router"));
const promotions_1 = __importDefault(require("./api/promotions/promotions"));
const timeout_router_1 = __importDefault(require("./api/timeout/timeout-router"));
const tables_router_1 = __importDefault(require("./api/tables/tables-router"));
const OrderTimeoutService_1 = require("./services/OrderTimeoutService");
app.use("/api/orders", orders_1.default);
app.use("/api/menu", menu_1.default);
app.use("/api/reviews", reviews_1.default);
app.use("/api/review/rating", rating_1.default);
app.use("/api/category", category_1.default);
app.use("/api/priceHistory", priceHistory_1.default);
app.use("/api/supplier", supplier_1.default);
app.use("/api/receipts", receipts_1.default);
app.use("/api/auth", auth_1.default);
app.use("/api/users", users_1.default);
app.use("/api/inventory", inventory_router_1.default);
app.use("/api/promotions", promotions_1.default);
app.use(timeout_router_1.default);
app.use(tables_router_1.default);
app.get("/", (req, res) => {
    res.json({
        message: "Restaurant Management API",
        version: "1.0.0",
        inventoryAlerts: inventoryManager ? "Active" : "Disabled",
    });
});
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: mongoose_1.default.connection.readyState === 1 ? "connected" : "disconnected",
        inventoryAlerts: inventoryManager ? "running" : "disabled",
    });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});
const handleShutdown = async (signal) => {
    console.log(`${signal} received. Initiating graceful shutdown...`);
    if (inventoryManager) {
        inventoryManager.stopAutomaticAlerts();
    }
    try {
        OrderTimeoutService_1.orderTimeoutService.stopTimeoutChecker();
        console.log("Order timeout checker stopped.");
    }
    catch (error) {
        console.error("Error stopping timeout checker:", error);
    }
    if (emailService && emailService.close) {
        try {
            await emailService.close();
            console.log("Email service closed.");
        }
        catch (error) {
            console.error("Error closing email service:", error);
        }
    }
    try {
        await new Promise((resolve) => {
            server.close(() => {
                console.log("HTTP/WebSocket server closed.");
                resolve();
            });
        });
    }
    catch (error) {
        console.error("Error closing server:", error);
    }
    if (mongoose_1.default.connection.readyState === 1) {
        try {
            await mongoose_1.default.connection.close(false);
            console.log("Database connection closed.");
        }
        catch (error) {
            console.error("Error closing database:", error);
        }
    }
    console.log("Shutdown complete.");
    process.exit(0);
};
process.on("SIGTERM", () => handleShutdown("SIGTERM").catch(console.error));
process.on("SIGINT", () => handleShutdown("SIGINT").catch(console.error));
server.listen(port, () => {
    console.log(`Server listening on port ${port} [${process.env.NODE_ENV || "development"}]`);
});
exports.default = app;
//# sourceMappingURL=server.js.map