"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_1 = require("./server/index");
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
const db_1 = __importDefault(require("./config/db"));
const rateLimter_1 = __importDefault(require("./middleware/rateLimter"));
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
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
//# sourceMappingURL=server.js.map