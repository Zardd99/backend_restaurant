import express, { Express } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";

import { initWebSocketServer } from "./server/index";

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
import connectDB from "./config/db";
import rateLimiter from "./middleware/rateLimter";

dotenv.config();

const app: Express = express();
const server = http.createServer(app);

initWebSocketServer(server);

const port = process.env.PORT || 5000;

connectDB();

const corsOptions: cors.CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://0.0.0.0:3000",
      "http://10.0.2.2:3000",
      "http://10.0.2.2:5000",
      "http://localhost:63360/",
      "http://localhost:63360",
      "http://localhost:63028/",
      "http://localhost:63028",
      "http://localhost:52358/",
      "http://localhost:52358",
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

app.use(cors(corsOptions));
app.use(express.json());
app.use(rateLimiter());
app.use(express.urlencoded({ extended: true }));

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

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
