import express, { Express } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { initWebSocketServer } from "./server/index";
import connectDB from "./config/db";
import rateLimiter from "./middleware/rateLimter";
import { mongoSanitize } from "./middleware/mongoSanitize";
import { setupDependencies, DependencyContainer } from "./config/dependencies";

/**
 * REST Management API Server
 * * Main entry point for the backend service. Handles middleware initialization,
 * database connectivity, Dependency Injection (DI) setup, and routing.
 */

dotenv.config();

/**
 * Fail fast if critical secrets are missing. Prevents the server from booting
 * in an insecure or non-functional state (e.g. missing JWT_SECRET).
 */
const REQUIRED_ENV = ["JWT_SECRET", "MONGODB_URI"] as const;
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `Critical Failure: missing required environment variables: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}
if ((process.env.JWT_SECRET as string).length < 32) {
  console.warn(
    "Warning: JWT_SECRET is shorter than 32 characters. Use a long, random secret in production.",
  );
}

const app: Express = express();
const server = http.createServer(app);

// Security headers. Cross-origin resource policy relaxed so the separate
// Vercel frontend can consume the API; transport is HTTPS in production.
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Initialize real-time communication layer and expose io on app for controllers
const io = initWebSocketServer(server);
app.set("io", io);

const port = process.env.PORT || 5000;

connectDB();

/**
 * CORS Configuration
 * Configured to support local development, staging (ngrok), and production environments.
 * Note: Dynamic origin matching is required for mobile testing via local network IPs.
 */
const corsOptions: cors.CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    if (!origin) return callback(null, true);

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
      ...(process.env.API_URL ? [process.env.API_URL as string] : []),
      ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN as string] : []),
      ...(process.env.IP ? [process.env.IP as string] : []),
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (
      origin.match(/http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/) ||
      origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok\.io$/) ||
      origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app$/) ||
      // Any Vercel deployment of this project: production, the dev/staging
      // git-branch previews, and per-commit preview URLs.
      origin.match(/^https:\/\/restaurant-mangement-system[a-z0-9-]*\.vercel\.app$/i)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  // Minimal header allowlist — only what the clients actually send.
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
    "ngrok-skip-browser-warning",
  ],
  exposedHeaders: ["Content-Length"],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200,
};

// Global Middleware Configuration
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// Strip Mongo operator keys ($, dotted) from all inputs before any handler runs.
app.use(mongoSanitize);
// Global throttle — bounded per IP across all REST endpoints.
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 2000 }));

/**
 * Dependency Injection Initialization
 * Bootstraps the DI container for service-layer resolution across the app.
 */
console.log("Setting up dependencies...");
try {
  setupDependencies();
} catch (error) {
  console.error("Critical Failure: Dependency setup failed", error);
  process.exit(1);
}

const container = DependencyContainer.getInstance();

interface InventoryManagerType {
  startAutomaticAlerts: () => void;
  stopAutomaticAlerts: () => void;
}

interface EmailServiceType {
  close?(): Promise<void>;
}

let inventoryManager: InventoryManagerType | undefined;
let emailService: EmailServiceType | undefined;

/**
 * Background Service: Inventory Alerts
 * Starts the polling mechanism for low stock notifications.
 */
try {
  inventoryManager = container.resolve(
    "InventoryManager",
  ) as InventoryManagerType;
  inventoryManager.startAutomaticAlerts();
} catch (error) {
  console.warn(
    "InventoryManager could not be initialized. Alerts will be disabled.",
  );
}

/**
 * Background Service: Order Timeout Checker
 * Starts the timeout checker for orders and prep steps.
 */
try {
  orderTimeoutService.startTimeoutChecker();
  console.log("Order timeout checker started successfully");
} catch (error) {
  console.warn("Order timeout checker could not be initialized:", error);
}

/**
 * Email Service Reference for Graceful Shutdown
 */
try {
  emailService = container.resolve("EmailService") as EmailServiceType;
} catch (error) {
  console.warn("EmailService could not be retrieved for shutdown.");
}

// Route Modules
import orderRoute from "./api/orders/orders";
import menuRoute from "./api/menu/menu";
import reviews from "./api/reviews/reviews";
import rating from "./api/reviews/rating/rating";
import category from "./api/category/category";
import priceHistory from "./api/priceHistory/priceHistory";
import supplierRoute from "./api/supplier/supplier";
import receiptRoutes from "./api/receipts/receipts";
import userRoutes from "./api/users/users";
import authRoutes from "./api/auth/auth";
import inventoryRoutes from "./api/inventory/inventory-router";
import promotionRoutes from "./api/promotions/promotions";
import timeoutRoutes from "./api/timeout/timeout-router";
import tablesRoutes from "./api/tables/tables-router";
import tableManagementRoutes from "./api/tables/table_routes";
import notificationRoutes from "./api/notifications/notifications";
import supportRoutes from "./api/support/support";
import billingRoutes from "./api/billing/billing";
import paymentRoutes from "./api/billing/payments";
import orderEditRoutes from "./api/orders/order-edit";
import voidCompRoutes from "./api/orders/void-comp";
import tableOpsRoutes from "./api/tables/table-ops";
import shiftRoutes from "./api/shifts/shifts";
import enterpriseOperationsRoutes from "./api/routes/enterprise_operations_routes";
import { orderTimeoutService } from "./services/OrderTimeoutService";

// API Endpoint Registration
app.use("/api/orders", orderRoute);
app.use("/api/menu", menuRoute);
app.use("/api/reviews", reviews);
app.use("/api/review/rating", rating);
app.use("/api/category", category);
app.use("/api/priceHistory", priceHistory);
app.use("/api/supplier", supplierRoute);
app.use("/api/receipts", receiptRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/promotions", promotionRoutes);
app.use(timeoutRoutes); // Timeout management routes
// Table-model management (auto-assign, seat, bus, join/split, floor map).
// Mounted before the legacy occupancy router so its explicit paths win.
app.use("/api/tables", tableManagementRoutes);
app.use(tablesRoutes); // Legacy order-derived table occupancy routes
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/billing", billingRoutes);

// P2 operational features
app.use("/api/billing", paymentRoutes); // /:id/split/*, /:id/khqr, /:id/pay
app.use("/api", orderEditRoutes); // /orders/:id/items, /menu/:id/availability
app.use("/api", voidCompRoutes); // /orders/:id/void, /comp, /audit
app.use("/api", tableOpsRoutes); // /tables/transfer, /tables/merge
app.use("/api/shifts", shiftRoutes);
app.use("/api/enterprise", enterpriseOperationsRoutes); // KDS, FIFO waste/COGS, menu engineering, offline sync

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
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    inventoryAlerts: inventoryManager ? "running" : "disabled",
  });
});

/**
 * Centralized Error Handling
 * Captures all unhandled errors. Stacks are hidden in production for security.
 */
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/**
 * Graceful Shutdown Process
 * Ensures database connections and background processes (Inventory Polling)
 * are terminated cleanly before the process exits.
 */
const handleShutdown = async (signal: string) => {
  console.log(`${signal} received. Initiating graceful shutdown...`);

  // Stop inventory alerts
  if (inventoryManager) {
    inventoryManager.stopAutomaticAlerts();
  }

  // Stop order timeout checker
  try {
    orderTimeoutService.stopTimeoutChecker();
    console.log("Order timeout checker stopped.");
  } catch (error) {
    console.error("Error stopping timeout checker:", error);
  }

  // Close email service connections
  if (emailService && emailService.close) {
    try {
      await emailService.close();
      console.log("Email service closed.");
    } catch (error) {
      console.error("Error closing email service:", error);
    }
  }

  // Close Socket.IO connections
  try {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log("HTTP/WebSocket server closed.");
        resolve();
      });
    });
  } catch (error) {
    console.error("Error closing server:", error);
  }

  // Close MongoDB connection
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close(false);
      console.log("Database connection closed.");
    } catch (error) {
      console.error("Error closing database:", error);
    }
  }

  console.log("Shutdown complete.");
  process.exit(0);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM").catch(console.error));
process.on("SIGINT", () => handleShutdown("SIGINT").catch(console.error));

server.listen(port, () => {
  console.log(
    `Server listening on port ${port} [${process.env.NODE_ENV || "development"}]`,
  );
});

export default app;
