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

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN as string] : []),
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
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
