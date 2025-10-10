"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocketServer = initWebSocketServer;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function initWebSocketServer(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: function (origin, callback) {
                if (!origin)
                    return callback(null, true);
                const allowedOrigins = [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "https://restaurant-mangement-system-seven.vercel.app",
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
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);
        const token = socket.handshake.query.token;
        const role = socket.handshake.query.role;
        const authToken = Array.isArray(token) ? token[0] : token;
        const authRole = Array.isArray(role) ? role[0] : role;
        if (!authToken || !authRole) {
            console.log("Authentication failed: Missing token or role");
            socket.disconnect();
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(authToken, process.env.JWT_SECRET);
            socket.data.user = decoded;
            socket.data.role = authRole;
            socket.data.previousRooms = [];
            socket.join(authRole);
            socket.data.previousRooms.push(authRole);
            console.log(`Client ${socket.id} authenticated as ${authRole}`);
        }
        catch (error) {
            console.log("Authentication failed: Invalid token");
            socket.disconnect();
            return;
        }
        socket.on("order_created", (orderData) => {
            if (socket.data.role !== "waiter") {
                socket.emit("error", {
                    message: "Unauthorized: Only waiters can create orders",
                });
                return;
            }
            io.to("chef").emit("order_created", orderData);
            console.log(`Order ${orderData._id} created and broadcast to kitchen`);
        });
        socket.on("order_status_update", (data) => {
            if (socket.data.role !== "chef") {
                socket.emit("error", {
                    message: "Unauthorized: Only chefs can update order status",
                });
                return;
            }
            io.to("waiter").emit("order_updated", data);
            console.log(`Order ${data.orderId} status updated to ${data.status}`);
        });
        socket.on("set_role", (newRole) => {
            if (["chef", "waiter"].includes(newRole)) {
                if (socket.data.previousRooms) {
                    socket.data.previousRooms.forEach((room) => {
                        socket.leave(room);
                    });
                }
                socket.join(newRole);
                socket.data.role = newRole;
                socket.data.previousRooms = [newRole];
                console.log(`Client ${socket.id} set role to ${newRole}`);
            }
        });
        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
    return io;
}
//# sourceMappingURL=index.js.map