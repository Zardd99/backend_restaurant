import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import http from "http";

/**
 * Attaches the Redis adapter when UPSTASH_REDIS_URL (the rediss:// TCP endpoint)
 * is configured, so real-time events fan out across multiple backend instances
 * and can be injected from the standalone worker via @socket.io/redis-emitter.
 * Falls back to the single-instance in-memory adapter when unset (local dev).
 */
function attachRedisAdapter(io: Server): void {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) return;

  try {
    const pubClient = new Redis(url, { lazyConnect: false });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (err) =>
      console.error("Socket.io Redis pub client error:", err.message),
    );
    subClient.on("error", (err) =>
      console.error("Socket.io Redis sub client error:", err.message),
    );
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter attached (multi-instance fan-out).");
  } catch (error) {
    console.error(
      "Failed to attach Socket.io Redis adapter; falling back to in-memory:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function initWebSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: function (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "https://restaurant-mangement-system-seven.vercel.app",
        ];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (
          origin.match(/http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/) ||
          origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok\.io$/) ||
          origin.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app$/) ||
          // Any Vercel deployment of this project (prod + dev/staging previews).
          origin.match(/^https:\/\/restaurant-mangement-system[a-z0-9-]*\.vercel\.app$/i)
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
      credentials: true, // This is important for including cookies/auth headers
    },
  });

  attachRedisAdapter(io);

  // Rest of your Socket.IO event handlers remain the same
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Handle authentication with proper type checking
    const token = socket.handshake.query.token;
    const role = socket.handshake.query.role;

    // Ensure token and role are strings, not arrays
    const authToken = Array.isArray(token) ? token[0] : token;
    const authRole = Array.isArray(role) ? role[0] : role;

    if (!authToken || !authRole) {
      console.log("Authentication failed: Missing token or role");
      socket.disconnect();
      return;
    }

    // Verify token
    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET!);
      socket.data.user = decoded;
      socket.data.role = authRole;
      socket.data.previousRooms = [];

      // Join room based on role
      socket.join(authRole);
      socket.data.previousRooms.push(authRole);
      console.log(`Client ${socket.id} authenticated as ${authRole}`);
    } catch (error) {
      console.log("Authentication failed: Invalid token");
      socket.disconnect();
      return;
    }

    // Order created event (from waiters)
    socket.on("order_created", (orderData) => {
      // Verify sender is a waiter
      if (socket.data.role !== "waiter") {
        socket.emit("error", {
          message: "Unauthorized: Only waiters can create orders",
        });
        return;
      }

      // Broadcast to all kitchen clients
      io.to("chef").emit("order_created", orderData);
      console.log(`Order ${orderData._id} created and broadcast to kitchen`);
    });

    // Order status update event (from chefs)
    socket.on(
      "order_status_update",
      (data: { orderId: string; status: string }) => {
        // Verify sender is a chef
        if (socket.data.role !== "chef") {
          socket.emit("error", {
            message: "Unauthorized: Only chefs can update order status",
          });
          return;
        }

        // Broadcast to all waiter clients
        io.to("waiter").emit("order_updated", data);
        console.log(`Order ${data.orderId} status updated to ${data.status}`);
      },
    );

    // Set role event handler
    socket.on("set_role", (newRole: string) => {
      if (["chef", "waiter"].includes(newRole)) {
        // Leave previous rooms
        const currentRole = socket.data.role;
        if (currentRole && currentRole !== newRole) {
          socket.leave(currentRole);
        }

        // Join new role room
        socket.join(newRole);
        socket.data.role = newRole;
        // Don't keep history of rooms to prevent memory accumulation
        socket.data.previousRooms = [newRole];

        console.log(`Client ${socket.id} set role to ${newRole}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Clean up socket data to prevent memory leaks
      if (socket.data.previousRooms) {
        socket.data.previousRooms.forEach((room: string) => {
          socket.leave(room);
        });
      }
      socket.data.user = null;
      socket.data.role = null;
      socket.data.previousRooms = null;
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
}
