// import { Request, Response, NextFunction } from "express";
// import {
//   broadcastToAll,
//   broadcastToKitchen,
//   broadcastToWaiters,
//   BroadcastMessage,
// } from "../server/index";

// // Extend Express Request interface to include user
// interface AuthenticatedRequest extends Request {
//   user?: {
//     id?: string;
//     _id?: string;
//     role?: string;
//   };
// }

// // Middleware to notify WebSocket clients about order changes
// export function notifyOrderUpdate(eventType: string = "orders_updated") {
//   return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
//     // Store the original json method
//     const originalJson = res.json;

//     // Override the json method to intercept successful responses
//     res.json = function (data: any) {
//       // Call the original json method first
//       const result = originalJson.call(this, data);

//       // Only broadcast if the response was successful (status < 400)
//       if (res.statusCode < 400) {
//         try {
//           // Determine what type of update occurred based on the HTTP method and route
//           let updateType = eventType;
//           const broadcastData: BroadcastMessage = {
//             type: updateType,
//             timestamp: new Date().toISOString(),
//           };

//           // Add specific data based on the operation
//           if (req.method === "POST" && req.route?.path?.includes("orders")) {
//             updateType = "new_order_created";
//             broadcastData.type = updateType;
//             broadcastData.orderId = data._id || data.id;
//           } else if (
//             req.method === "PATCH" &&
//             req.route?.path?.includes("status")
//           ) {
//             updateType = "order_status_updated";
//             broadcastData.type = updateType;
//             broadcastData.orderId = req.params.id;
//             broadcastData.status = req.body.status;
//           } else if (req.method === "PUT" || req.method === "PATCH") {
//             updateType = "order_modified";
//             broadcastData.type = updateType;
//             broadcastData.orderId = req.params.id;
//           } else if (req.method === "DELETE") {
//             updateType = "order_deleted";
//             broadcastData.type = updateType;
//             broadcastData.orderId = req.params.id;
//           }

//           // Add user information if available
//           if (req.user) {
//             broadcastData.updatedBy = req.user.id || req.user._id;
//           }

//           // Broadcast the update
//           console.log(`Broadcasting ${updateType} to WebSocket clients`);
//           broadcastToAll(broadcastData);
//         } catch (error) {
//           console.error("Error broadcasting WebSocket update:", error);
//           // Don't fail the request if WebSocket broadcast fails
//         }
//       }

//       return result;
//     };

//     next();
//   };
// }

// // Specific middleware for different types of order operations
// export const notifyNewOrder = notifyOrderUpdate("new_order_created");
// export const notifyOrderStatusUpdate = notifyOrderUpdate(
//   "order_status_updated"
// );
// export const notifyOrderModification = notifyOrderUpdate("order_modified");
// export const notifyOrderDeletion = notifyOrderUpdate("order_deleted");

// // Advanced middleware that can target specific client groups
// export function notifySpecificClients(
//   targetRole: "all" | "kitchen" | "waiter" = "all",
//   eventType: string = "orders_updated"
// ) {
//   return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
//     const originalJson = res.json;

//     res.json = function (data: any) {
//       const result = originalJson.call(this, data);

//       if (res.statusCode < 400) {
//         try {
//           const broadcastData: BroadcastMessage = {
//             type: eventType,
//             timestamp: new Date().toISOString(),
//             orderId: data._id || data.id || req.params.id,
//             updatedBy: req.user?.id || req.user?._id,
//           };

//           // Add request-specific data
//           if (req.method === "PATCH" && req.route?.path?.includes("status")) {
//             broadcastData.status = req.body.status;
//           }

//           // Target specific client groups
//           switch (targetRole) {
//             case "kitchen":
//               broadcastToKitchen(broadcastData);
//               break;
//             case "waiter":
//               broadcastToWaiters(broadcastData);
//               break;
//             default:
//               broadcastToAll(broadcastData);
//           }
//         } catch (error) {
//           console.error("Error in targeted WebSocket broadcast:", error);
//         }
//       }

//       return result;
//     };

//     next();
//   };
// }

// // Middleware to handle WebSocket errors gracefully
// export function handleWebSocketErrors(
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) {
//   // Add error handling for WebSocket-related operations
//   const originalSend = res.send;
//   const originalJson = res.json;

//   res.send = function (data: any) {
//     try {
//       return originalSend.call(this, data);
//     } catch (error) {
//       console.error("Error in response send:", error);
//       return originalSend.call(this, data);
//     }
//   };

//   res.json = function (data: any) {
//     try {
//       return originalJson.call(this, data);
//     } catch (error) {
//       console.error("Error in response json:", error);
//       return originalJson.call(this, data);
//     }
//   };

//   next();
// }

// // Utility function to manually trigger broadcasts from anywhere in your app
// export function triggerOrderUpdate(
//   eventType: string,
//   orderData: any,
//   userId: string | null = null
// ): void {
//   try {
//     const broadcastData: BroadcastMessage = {
//       type: eventType,
//       timestamp: new Date().toISOString(),
//       ...orderData,
//     };

//     if (userId) {
//       broadcastData.updatedBy = userId;
//     }

//     broadcastToAll(broadcastData);
//     console.log(`Manual broadcast triggered: ${eventType}`);
//   } catch (error) {
//     console.error("Error in manual broadcast:", error);
//   }
// }

// export default {
//   notifyOrderUpdate,
//   notifyNewOrder,
//   notifyOrderStatusUpdate,
//   notifyOrderModification,
//   notifyOrderDeletion,
//   notifySpecificClients,
//   handleWebSocketErrors,
//   triggerOrderUpdate,
// };
