import express, { Express } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { initWebSocketServer } from "./server/index";
import connectDB from "./config/db";
import rateLimiter from "./middleware/rateLimter";
import { setupDependencies, DependencyContainer } from "./config/dependencies";

/**
 * REST Management API Server
 * * Main entry point for the backend service. Handles middleware initialization,
 * database connectivity, Dependency Injection (DI) setup, and routing.
 */

dotenv.config();

const app: Express = express();
const server = http.createServer(app);

// Initialize real-time communication layer
initWebSocketServer(server);

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
      "http://localhost:62496/",
      "http://localhost:62496",
      "http://localhost:55654/",
      "http://localhost:55654",
      "http://localhost:50406/",
      "http://localhost:53220/",
      "http://localhost:53220",
      ...(process.env.API_URL ? [process.env.API_URL as string] : []),
      ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN as string] : []),
      ...(process.env.IP ? [process.env.IP as string] : []),
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (
      origin.match(/http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/) ||
      origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok\.io$/) ||
      origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app$/)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  // Comprehensive header list to accommodate Vercel, Ngrok, and Custom Auth flows
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

// Global Middleware Configuration
app.use(cors(corsOptions));
app.use(express.json());
app.use(rateLimiter());
app.use(express.urlencoded({ extended: true }));

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

let inventoryManager: InventoryManagerType | undefined;

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
const handleShutdown = (signal: string) => {
  console.log(`${signal} received. Initiating graceful shutdown...`);

  if (inventoryManager) {
    inventoryManager.stopAutomaticAlerts();
  }

  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(false).then(() => {
      console.log("Database connection closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

server.listen(port, () => {
  console.log(
    `Server listening on port ${port} [${process.env.NODE_ENV || "development"}]`,
  );
});

export default app;
