import express, { Express } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";

import { initWebSocketServer } from "./server/index";

import orderRoute from "./api/orders/route";
import menuRoute from "./api/menu/route";
import reviews from "./api/reviews/route";
import rating from "./api/reviews/rating/route";
import category from "./api/category/route";
import priceHistory from "./api/priceHistory/route";
import supplierRoute from "./api/supplier/route";
import receiptRoutes from "./api/receipts/route";
import userRoutes from "./api/users/route";
import authRoutes from "./api/auth/route";
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
