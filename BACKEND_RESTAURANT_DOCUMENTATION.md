# Backend Restaurant Management System - Technical Documentation

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture & Design](#architecture--design)
3. [Module Breakdown](#module-breakdown)
4. [Implementation Logic](#implementation-logic)
5. [API Specifications](#api-specifications)
6. [Setup & Deployment](#setup--deployment)
7. [Data Models](#data-models)
8. [Error Handling & Validation](#error-handling--validation)
9. [Real-Time Communication](#real-time-communication)
10. [Security & Authentication](#security--authentication)

---

## Executive Summary

### Project Overview

**Backend Restaurant Management System** is a comprehensive Node.js + Express backend service designed to power a complete restaurant management ecosystem. It provides REST APIs for managing orders, inventory, menu items, user authentication, price history, receipts, and analytics.

### Primary Value Proposition

- **Multi-Role Management System**: Support for admin, manager, chef, waiter, and cashier roles with granular permission control
- **Real-Time Inventory Tracking**: Automated low-stock detection and notification system with email alerts
- **Order Management Pipeline**: Complete order lifecycle from creation to fulfillment with status tracking
- **Analytics & Reporting**: Comprehensive statistics on orders, revenue, and business metrics
- **WebSocket Integration**: Real-time updates for staff coordination and order management
- **Production-Ready**: Docker containerization, CORS handling, rate limiting, and comprehensive error handling

### Technology Stack

| Technology     | Purpose                 | Version |
| -------------- | ----------------------- | ------- |
| **Node.js**    | Runtime environment     | Latest  |
| **Express.js** | Web framework           | ^5.0.0  |
| **TypeScript** | Language                | Latest  |
| **MongoDB**    | Primary database        | 6.10.4  |
| **Mongoose**   | ODM & validation        | ^8.0.0  |
| **Socket.io**  | Real-time communication | ^4.8.0  |
| **JWT**        | Authentication          | ^9.0.0  |
| **Bcryptjs**   | Password hashing        | ^3.0.0  |
| **Nodemailer** | Email service           | Latest  |
| **Upstash**    | Rate limiting & caching | ^2.0.6  |

---

## Architecture & Design

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│         (Web, Mobile, Admin Dashboard)                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
    HTTP/REST              WebSocket (Socket.io)
         │                          │
┌────────┴──────────────────────────┴─────────────────────────────┐
│                    Express Server (Port 5000)                    │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           CORS & Request Pipeline                         │  │
│  │  (Middleware: CORS, Auth, RateLimit, Body Parser)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Route Layer (API Routes)                     │  │
│  │  /api/orders, /api/menu, /api/users, /api/auth, etc     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           Controller Layer                               │  │
│  │  Business logic, request validation, response handling   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   Application Layer (Use Cases, Managers, Services)      │  │
│  │  - CheckLowStockUseCase                                  │  │
│  │  - ConsumeIngredientsUseCase                             │  │
│  │  - InventoryManager                                      │  │
│  │  - StatsManager                                          │  │
│  │  - EmailService                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │      Domain Layer (Repositories, Domain Models)          │  │
│  │  - IngredientRepository                                  │  │
│  │  - MenuItemRepository                                    │  │
│  │  - StatsRepository                                       │  │
│  │  - LowStockNotificationRepository                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │    Infrastructure Layer (MongoDB, Email, External API)   │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
         │
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
    ▼                                           ▼
┌─────────────────────────┐         ┌──────────────────────────┐
│   MongoDB (Primary DB)  │         │ Email Service (SMTP)     │
│  - Orders              │         │ (Nodemailer)             │
│  - Users               │         │                          │
│  - Menu Items          │         │ Upstash (Cache/RateLimit)│
│  - Ingredients         │         │                          │
│  - Notifications       │         │                          │
└─────────────────────────┘         └──────────────────────────┘
```

### Architectural Patterns

#### 1. **Layered Architecture (Clean Architecture)**

The system is organized into distinct layers with clear separation of concerns:

- **Presentation Layer**: Express routes and controllers
- **Application Layer**: Use cases, managers, and business logic
- **Domain Layer**: Core business entities, repositories, and domain logic
- **Infrastructure Layer**: Database, email, and external service implementations

**Benefits:**

- Testability: Each layer can be tested independently
- Maintainability: Clear separation of concerns
- Flexibility: Easy to swap implementations (mock vs. real)

#### 2. **Dependency Injection (DI) / Inversion of Control (IoC)**

The `DependencyContainer` class manages all application dependencies:

```typescript
// DependencyContainer acts as IoC Container
const container = DependencyContainer.getInstance();
container.register("ingredientRepository", mongoRepository);
container.register("checkLowStockUseCase", useCase);

// Later, resolve dependencies
const useCase = container.resolve("checkLowStockUseCase");
```

**Advantages:**

- Loose coupling between components
- Easy unit testing with mock implementations
- Centralized dependency configuration

#### 3. **Repository Pattern**

Data access is abstracted through repository interfaces:

```typescript
interface IngredientRepository {
  findLowStockIngredients(): Promise<Result<Ingredient[]>>;
  findById(id: string): Promise<Result<Ingredient>>;
  save(ingredient: Ingredient): Promise<Result<Ingredient>>;
}
```

**Benefits:**

- Database independence
- Easier to mock for testing
- Consistent data access patterns

#### 4. **Use Case Pattern (Application Services)**

Each business operation is encapsulated in a use case class:

```typescript
class CheckLowStockUseCase {
  async execute(): Promise<Result<{ lowStockIngredients, notificationsCreated }>
}
```

**Rationale:**

- Clear business logic organization
- Reusable across controllers and scheduled tasks
- Easy to understand and test

#### 5. **Result Type for Error Handling**

```typescript
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
```

This eliminates ambiguous error states and provides explicit error handling.

### Data Flow Architecture

#### Order Creation Flow

```
Client Request
    ↓
[POST /api/orders]
    ↓
AuthMiddleware (JWT Token Validation)
    ↓
RateLimiter (Upstash)
    ↓
OrderController.createOrder()
    ↓
Validation & Sanitization
    ↓
ConsumeIngredientsUseCase.execute()
    ├─→ InventoryManager (Deduct ingredients)
    └─→ LowStockNotificationRepository (Create alerts)
    ↓
Order.save() [MongoDB]
    ↓
WebSocket Event: "order_created"
    ├─→ Kitchen Display System
    ├─→ Waiter Interface
    └─→ Admin Dashboard
    ↓
HTTP Response (201 Created)
```

#### Inventory Low Stock Detection Flow

```
Scheduled Task (Interval-based)
    ↓
CheckLowStockUseCase.execute()
    ↓
IngredientRepository.findLowStockIngredients()
    ├─→ Queries MongoDB for items below reorder point
    └─→ Returns filtered list
    ↓
For Each Low Stock Item:
    ├─→ Check if notification already exists
    ├─→ Create new notification (if not exists)
    └─→ Prevent duplicate alerts
    ↓
EmailService.sendAlert()
    ├─→ SMTP via Nodemailer
    └─→ Notify managers/admins
    ↓
WebSocket Broadcast: "low_stock_alert"
    └─→ Real-time UI updates
```

---

## Module Breakdown

### 1. **Controllers** (`/controllers`)

Controllers handle HTTP requests and coordinate the response flow.

#### Files:

- `orderController.ts` - Order CRUD and statistics
- `menuController.ts` - Menu item management
- `userController.ts` - User profile and management
- `authController.ts` - Login, registration, token refresh
- `inventoryController.ts` - Stock tracking and alerts
- `supplierController.ts` - Supplier management
- `priceHistoryController.ts` - Price tracking
- `receiptController.ts` - Receipt generation and retrieval
- `reviewController.ts` & `ratingController.ts` - Feedback system
- `categoryController.ts` - Menu categories

#### Key Responsibilities:

- Request validation and parameter extraction
- Calling appropriate business logic (use cases, managers)
- Response formatting and HTTP status codes
- Error handling and logging

#### Example: Order Statistics Controller

```typescript
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const statsManager = container.resolve<StatsManager>("statsManager");
    const result = await statsManager.getStats();

    if (result.ok) {
      res.json(result.value);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
```

### 2. **API Routes** (`/api`)

Modular route handlers organized by domain:

#### Route Structure:

```
/api
├── /auth                 - Authentication endpoints
├── /users                - User CRUD operations
├── /orders               - Order management
├── /menu                 - Menu item management
├── /inventory            - Inventory operations
├── /category             - Category management
├── /suppliers            - Supplier management
├── /priceHistory         - Price tracking
├── /receipts             - Receipt operations
├── /reviews              - Customer reviews
└── /rates                - Ratings
```

#### Order Route Example:

```typescript
// /api/orders/orders.ts
router.get("/", authorize("admin", "manager", "chef"), getAllOrders);
router.post("/", authorize("admin", "manager", "waiter"), createOrder);
router.patch(
  "/:id/status",
  authorize("admin", "manager", "chef"),
  updateOrderStatus,
);
```

**Design Rationale:**

- Routes are grouped by resource entity
- Each route file is independent and can be tested separately
- Clear authorization boundaries

### 3. **Application Layer** (`/application`)

Contains business logic that is independent of frameworks.

#### 3.1 Use Cases (`/use-cases`)

Encapsulate specific business operations:

- **CheckLowStockUseCase**
  - Scans inventory for depleted items
  - Creates notifications to prevent duplicates
  - Returns summary of low stock items

- **ConsumeIngredientsUseCase**
  - Deducts ingredients when orders are created
  - Tracks inventory changes
  - Updates stock levels in MongoDB

- **GetOrderStatsUseCase**
  - Aggregates order data
  - Calculates metrics (total revenue, average order value)
  - Filters by date ranges and order types

#### 3.2 Managers (`/managers`)

Orchestrate complex operations involving multiple entities:

- **InventoryManager**
  - Coordinates ingredient deduction
  - Manages low stock alerts
  - Handles supplier interactions

- **StatsManager**
  - Aggregates business metrics
  - Generates reports
  - Calculates KPIs

### 4. **Domain Layer** (`/domain`)

Contains core business logic and entity definitions:

#### Repositories:

```typescript
interface IngredientRepository {
  findLowStockIngredients(): Promise<Result<Ingredient[]>>;
  findById(id: string): Promise<Result<Ingredient>>;
  save(ingredient: Ingredient): Promise<Result<Ingredient>>;
}

interface StatsRepository {
  getOrderStats(filters: StatsFilter): Promise<Result<OrderStats>>;
  getRevenueTrend(days: number): Promise<Result<RevenueTrend[]>>;
}
```

### 5. **Infrastructure Layer** (`/infrastructure`)

Implements data access and external services:

#### 5.1 Repositories

- `mongodb-ingredient-repository.ts` - MongoDB ingredient queries
- `mongodb-menu-item-repository.ts` - Menu item persistence
- `MongoStatsRepository.ts` - Aggregation queries for analytics

#### 5.2 Services

- `nodemailer-email-service.ts` - SMTP-based email delivery

**Example: Email Service**

```typescript
export class NodemailerEmailService implements EmailService {
  async sendLowStockAlert(recipients: string[], ingredients: Ingredient[]) {
    const mailOptions = {
      to: recipients.join(","),
      subject: "Low Stock Alert",
      html: this.generateAlertHTML(ingredients),
    };
    return await this.transporter.sendMail(mailOptions);
  }
}
```

### 6. **Models** (`/models`)

Mongoose schema definitions providing data structure and validation:

#### Core Models:

- **Order** - Order details, items, status, inventory deduction info
- **User** - User profile, role, authentication credentials
- **MenuItem** - Menu item details, pricing, dietary info
- **Ingredient** - Stock levels, reorder points, suppliers
- **Category** - Menu categorization
- **Supplier** - Supplier contact and inventory info
- **Receipt** - Order receipts and payment records
- **Review & Rating** - Customer feedback
- **PriceHistory** - Historical price tracking
- **LowStockNotification** - Stock alert records

### 7. **Middleware** (`/middleware`)

Request processing and cross-cutting concerns:

#### 7.1 Authentication Middleware

```typescript
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
};
```

#### 7.2 Authorization Middleware

```typescript
export const authorize =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
```

#### 7.3 Rate Limiter

```typescript
// Uses Upstash Redis-based rate limiting
// Hard limit per IP: 100 requests per minute
// Prevents abuse and DOS attacks
```

### 8. **Configuration** (`/config`)

Bootstrapping and environment setup:

- **db.ts** - MongoDB connection with retry logic
- **dependencies.ts** - DI container setup and registration
- **upstash.ts** - Rate limiting service initialization

**DependencyContainer Setup:**

```typescript
export function setupDependencies(): DependencyContainer {
  const container = DependencyContainer.getInstance();

  // Phase 1: Infrastructure
  container.register("ingredientRepository", new MongoDBIngredientRepository());

  // Phase 2: Services
  container.register("emailService", new NodemailerEmailService());

  // Phase 3: Application
  container.register(
    "checkLowStockUseCase",
    new CheckLowStockUseCase(
      container.resolve("ingredientRepository"),
      container.resolve("notificationRepository"),
    ),
  );

  return container;
}
```

### 9. **Utilities** (`/utils`)

Helper functions and common operations:

- `validation.ts` - Input validation schemas and rules
- `db.ts` - Database connection helpers

---

## Implementation Logic

### 1. Order Creation with Inventory Deduction

**Flow:**

1. Client sends POST request to `/api/orders`
2. Controller validates request and extracts order items
3. `ConsumeIngredientsUseCase` is executed:
   - For each menu item, fetch related ingredients
   - Check current stock levels
   - Deduct quantities from inventory
   - Create low stock notifications if thresholds breached
4. Order is saved with inventory deduction status
5. WebSocket event broadcasts to kitchen and waiters
6. Response sent with order ID and status

**Key Implementation:**

```typescript
async createOrder(req: Request, res: Response) {
  const { items, tableNumber, orderType } = req.body;

  // 1. Calculate total and validate items exist
  const menuItems = await MenuItem.find({ _id: { $in: itemIds } });
  const totalAmount = calculateTotal(items, menuItems);

  // 2. Execute use case to reserve inventory
  const consumeResult = await consumeIngredientsUseCase.execute(items);

  // 3. Save order with deduction status
  const order = await Order.create({
    items,
    totalAmount,
    customer: req.user._id,
    status: "pending",
    orderType,
    inventoryDeduction: consumeResult.deductionInfo
  });

  // 4. Broadcast real-time update
  req.app.get("io").emit("order_created", order);

  res.status(201).json(order);
}
```

### 2. Low Stock Detection & Notification

**Trigger:** Scheduled task (could be cron job or manual endpoint)

**Algorithm:**

1. Query ingredients where `currentStock < reorderPoint`
2. For each low stock item:
   - Check if unacknowledged notification exists
   - Create notification only if none exists (idempotency)
   - Add to email recipients list
3. Send bulk email to managers
4. Broadcast WebSocket event for real-time UI

**Idempotency Logic:**
Prevents "alert fatigue" by tracking notification state:

```typescript
async execute() {
  const lowStockItems = await ingredientRepository.findLowStockIngredients();

  for (const item of lowStockItems) {
    // Check if notification already exists and unacknowledged
    const existing = await notificationRepo.findByIngredientId(item.id);

    // Only create if not exists
    if (!existing.value) {
      await notificationRepo.create(notification);
      notificationsCreated++;
    }
  }
}
```

### 3. Role-Based Access Control (RBAC)

**Roles:**

- **Admin**: Full system access
- **Manager**: Inventory, staff, and report access
- **Chef**: Order status updates, inventory read
- **Waiter**: Order creation and management
- **Cashier**: Receipt and payment processing

**Implementation:**

```typescript
// Middleware applies role checks
router.patch("/:id/status",
  authorize("admin", "manager", "chef"), // Endpoint-level RBAC
  updateOrderStatus
);

// Within controller, additional permission checks
async updateOrderStatus(req: Request, res: Response) {
  const { status } = req.body;

  // Role-specific status transitions
  if (!canTransitionStatus(req.user.role, currentStatus, status)) {
    return res.status(403).json({ error: "Invalid status transition" });
  }
}
```

### 4. WebSocket Real-Time Updates

**Events:**

- `order_created` - New order placed
- `order_updated` - Order status changed
- `low_stock_alert` - Inventory below threshold
- `user_connected` - User login
- `user_reconnected` - User session restored

**Server-Side:**

```typescript
// WebSocket initialization in server.ts
export function initWebSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: corsOptions,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // Authenticate user
    const userId = socket.handshake.query.userId;
    const role = socket.handshake.query.role;

    // Join role-based rooms
    socket.join(`role-${role}`);

    // Subscribe to specific orders
    socket.on("watch_order", (orderId) => {
      socket.join(`order-${orderId}`);
    });
  });

  app.set("io", io);
}
```

**Broadcasting:**

```typescript
// Notify all kitchen staff of new order
req.app.get("io").to("role-chef").emit("order_created", order);

// Notify specific waiter of order status
req.app.get("io").to(`waiter-${waiterId}`).emit("order_updated", order);
```

---

## API Specifications

### Authentication Endpoints

#### POST `/api/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "name": "John Chef",
  "email": "john@restaurant.com",
  "password": "SecurePass123!",
  "role": "chef",
  "phone": "+1-555-0123"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Chef",
    "email": "john@restaurant.com",
    "role": "chef",
    "isActive": true
  }
}
```

**Status Codes:**

- `201 Created` - User registered successfully
- `400 Bad Request` - Validation error
- `409 Conflict` - Email already exists

---

#### POST `/api/auth/login`

Authenticate user and obtain JWT token.

**Request Body:**

```json
{
  "email": "john@restaurant.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Chef",
    "email": "john@restaurant.com",
    "role": "chef",
    "isActive": true
  }
}
```

**Status Codes:**

- `200 OK` - Login successful
- `400 Bad Request` - Missing credentials
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account disabled

---

### Orders Endpoints

#### GET `/api/orders`

Retrieve all orders with optional filtering.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by order status: pending, confirmed, preparing, ready, served, cancelled |
| customer | string | No | Filter by customer ID |
| orderType | string | No | Filter by type: dine-in, takeaway, delivery |
| startDate | ISO8601 | No | Filter from date (inclusive) |
| endDate | ISO8601 | No | Filter to date (inclusive) |
| minAmount | number | No | Filter by minimum total amount |
| maxAmount | number | No | Filter by maximum total amount |

**Example Request:**

```
GET /api/orders?status=confirmed&startDate=2026-01-01&endDate=2026-02-09&minAmount=50
```

**Response (200 OK):**

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "items": [
      {
        "menuItem": {
          "_id": "507f191e810c19729de860ea",
          "name": "Grilled Salmon",
          "price": 24.99
        },
        "quantity": 2,
        "price": 24.99,
        "specialInstructions": "No lemon asada"
      }
    ],
    "totalAmount": 49.98,
    "status": "preparing",
    "customer": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "tableNumber": 5,
    "orderType": "dine-in",
    "orderDate": "2026-02-09T14:30:00Z",
    "inventoryDeduction": {
      "status": "completed",
      "timestamp": "2026-02-09T14:30:05Z",
      "lastUpdated": "2026-02-09T14:30:05Z"
    },
    "createdAt": "2026-02-09T14:30:00Z",
    "updatedAt": "2026-02-09T14:35:00Z"
  }
]
```

**Authorization:** Requires authentication. Roles: admin, manager, chef, waiter, cashier

**Status Codes:**

- `200 OK` - Orders retrieved successfully
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server error

---

#### POST `/api/orders`

Create a new order.

**Request Body:**

```json
{
  "items": [
    {
      "menuItem": "507f191e810c19729de860ea",
      "quantity": 2,
      "specialInstructions": "No lemon asada"
    },
    {
      "menuItem": "507f191e810c19729de860eb",
      "quantity": 1
    }
  ],
  "customer": "507f1f77bcf86cd799439012",
  "tableNumber": 5,
  "orderType": "dine-in"
}
```

**Response (201 Created):**

```json
{
  "_id": "507f1f77bcf86cd799439023",
  "items": [
    {
      "menuItem": "507f191e810c19729de860ea",
      "quantity": 2,
      "price": 24.99,
      "specialInstructions": "No lemon asada"
    }
  ],
  "totalAmount": 49.98,
  "status": "pending",
  "customer": "507f1f77bcf86cd799439012",
  "tableNumber": 5,
  "orderType": "dine-in",
  "orderDate": "2026-02-09T14:35:00Z",
  "inventoryDeduction": {
    "status": "pending"
  },
  "createdAt": "2026-02-09T14:35:00Z"
}
```

**Authorization:** Requires authentication. Roles: admin, manager, waiter

**Status Codes:**

- `201 Created` - Order created successfully
- `400 Bad Request` - Validation error or invalid items
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Menu item not found
- `500 Internal Server Error` - Server error

---

#### PATCH `/api/orders/:id/status`

Update the status of an order.

**Request Body:**

```json
{
  "status": "ready",
  "notes": "Order is plated and ready for pickup"
}
```

**Response (200 OK):**

```json
{
  "_id": "507f1f77bcf86cd799439023",
  "status": "ready",
  "items": [
    /* ... */
  ],
  "totalAmount": 49.98,
  "updatedAt": "2026-02-09T14:45:00Z"
}
```

**Status Transitions:**

- `pending` → `confirmed` → `preparing` → `ready` → `served`
- Any status → `cancelled`

**Authorization:** Requires authentication. Roles: admin, manager, chef, waiter

**Status Codes:**

- `200 OK` - Status updated successfully
- `400 Bad Request` - Invalid status transition
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Order not found
- `500 Internal Server Error` - Server error

---

#### GET `/api/orders/stats`

Retrieve comprehensive order statistics and analytics.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | ISO8601 | No | Statistics from date (inclusive) |
| endDate | ISO8601 | No | Statistics to date (inclusive) |
| groupBy | string | No | Group by: "day", "week", "month", "status", "orderType" |

**Response (200 OK):**

```json
{
  "totalOrders": 1250,
  "totalRevenue": 32450.75,
  "averageOrderValue": 25.96,
  "ordersByStatus": {
    "served": 1200,
    "cancelled": 30,
    "pending": 20
  },
  "ordersByType": {
    "dine-in": 800,
    "takeaway": 300,
    "delivery": 150
  },
  "topMenuItems": [
    {
      "itemId": "507f191e810c19729de860ea",
      "name": "Grilled Salmon",
      "orderCount": 156,
      "revenue": 3898.44
    }
  ],
  "revenueTrend": [
    {
      "date": "2026-02-01",
      "revenue": 2456.8,
      "orderCount": 95
    }
  ]
}
```

**Authorization:** Requires authentication. Roles: admin, manager

---

#### DELETE `/api/orders/:id`

Delete/cancel an order.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

**Authorization:** Requires authentication. Roles: admin, manager

---

### Menu Endpoints

#### GET `/api/menu`

Retrieve all menu items with optional filtering.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category ID |
| priceRange | string | No | Format: "min-max" e.g., "10-50" |
| isAvailable | boolean | No | Filter by availability |

**Response (200 OK):**

```json
[
  {
    "_id": "507f191e810c19729de860ea",
    "name": "Grilled Salmon",
    "description": "Fresh Atlantic salmon with herbs",
    "price": 24.99,
    "category": "seafood",
    "ingredients": [
      {
        "ingredientId": "507f191e810c19729de860eb",
        "name": "Salmon Fillet",
        "quantity": 200,
        "unit": "grams"
      }
    ],
    "isAvailable": true,
    "preparationTime": 15,
    "allergens": ["fish", "gluten"],
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2026-02-09T10:00:00Z"
  }
]
```

---

#### POST `/api/menu`

Create a new menu item.

**Request Body:**

```json
{
  "name": "Grilled Salmon",
  "description": "Fresh Atlantic salmon with herbs",
  "price": 24.99,
  "category": "607f191e810c19729de860ec",
  "ingredients": [
    {
      "ingredientId": "507f191e810c19729de860eb",
      "quantity": 200,
      "unit": "grams"
    }
  ],
  "preparationTime": 15,
  "allergens": ["fish", "gluten"]
}
```

**Authorization:** Requires authentication. Roles: admin, manager

---

### Inventory Endpoints

#### GET `/api/inventory`

Retrieve current inventory status.

**Response (200 OK):**

```json
{
  "items": [
    {
      "_id": "507f191e810c19729de860eb",
      "name": "Salmon Fillet",
      "currentStock": 15,
      "unit": "kg",
      "minStock": 5,
      "reorderPoint": 8,
      "supplier": "Fresh Seafood Co.",
      "lastRestocked": "2026-02-08T10:00:00Z",
      "status": "optimal"
    },
    {
      "_id": "507f191e810c19729de860ec",
      "name": "Ground Beef",
      "currentStock": 3,
      "unit": "kg",
      "minStock": 10,
      "reorderPoint": 15,
      "supplier": "Meat Suppliers Inc.",
      "lastRestocked": "2026-02-07T10:00:00Z",
      "status": "low"
    }
  ],
  "lowStockAlerts": 5,
  "lastAudit": "2026-02-09T12:00:00Z"
}
```

---

#### POST `/api/inventory/check-low-stock`

Manually trigger low stock detection and notification.

**Response (200 OK):**

```json
{
  "lowStockIngredients": [
    {
      "id": "507f191e810c19729de860ec",
      "name": "Ground Beef",
      "currentStock": 3,
      "minStock": 10,
      "reorderPoint": 15,
      "unit": "kg"
    }
  ],
  "notificationsCreated": 1
}
```

---

### User Endpoints

#### GET `/api/users/:id`

Retrieve user profile information.

**Response (200 OK):**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Chef",
  "email": "john@restaurant.com",
  "role": "chef",
  "phone": "+1-555-0123",
  "isActive": true,
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2026-02-09T10:00:00Z"
}
```

**Authorization:** Requires authentication. Users can only view their own profile unless admin.

---

#### PUT `/api/users/:id`

Update user profile information.

**Request Body:**

```json
{
  "name": "John Chef Updated",
  "phone": "+1-555-0124"
}
```

**Authorization:** Requires authentication.

---

---

## Setup & Deployment

### Prerequisites

- **Node.js** v18.0.0 or higher
- **npm** v8.0.0 or higher
- **MongoDB** v6.0+ (local or Atlas)
- **Docker** (optional, for containerized deployment)

### Local Development Setup

#### 1. Clone Repository

```bash
git clone https://github.com/Zardd99/backend_restaurant.git
cd backend_restaurant
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Environment Configuration

Create a `.env` file in the project root:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/restaurant_db
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/restaurant_db

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Email Service (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=no-reply@restaurant.com

# CORS Origins
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
API_URL=http://localhost:5000

# Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Logging
LOG_LEVEL=debug

# Feature Flags
ENABLE_EMAIL_ALERTS=true
ENABLE_REAL_TIME_ALERTS=true
```

#### 4. Start MongoDB (if running locally)

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or, if MongoDB is installed locally
mongod
```

#### 5. Build TypeScript

```bash
npm run build
```

#### 6. Start Development Server

```bash
npm run dev
# Server runs on http://localhost:5000
```

### Production Deployment

#### Docker Deployment

1. **Build Docker Image**

   ```bash
   docker build -t backend-restaurant:1.0.0 .
   ```

2. **Run Container**

   ```bash
   docker run -d \
     -p 5000:5000 \
     --name restaurant-backend \
     -e MONGODB_URI=mongodb://mongo:27017/restaurant_db \
     -e JWT_SECRET=production_secret_key \
     --link mongo:mongo \
     backend-restaurant:1.0.0
   ```

3. **Using Docker Compose**

   ```bash
   docker-compose up -d
   ```

   **docker-compose.yml:**

   ```yaml
   version: "3.8"
   services:
     mongo:
       image: mongo:latest
       environment:
         MONGO_INITDB_DATABASE: restaurant_db
       volumes:
         - mongo_data:/data/db
       ports:
         - "27017:27017"

     backend:
       build: .
       ports:
         - "5000:5000"
       environment:
         MONGODB_URI: mongodb://mongo:27017/restaurant_db
         NODE_ENV: production
         JWT_SECRET: ${JWT_SECRET}
       depends_on:
         - mongo
       restart: always

   volumes:
     mongo_data:
   ```

#### Environment Variables for Production

| Variable                 | Example               | Notes                                           |
| ------------------------ | --------------------- | ----------------------------------------------- |
| `NODE_ENV`               | production            | Must be "production" for optimizations          |
| `MONGODB_URI`            | mongodb+srv://...     | Use MongoDB Atlas for managed service           |
| `JWT_SECRET`             | complex-random-string | Must be strong and unique                       |
| `UPSTASH_REDIS_REST_URL` | https://...           | For rate limiting across instances              |
| `EMAIL_PASSWORD`         | app-password          | Use app-specific password, not account password |

#### Health Check

Once running, verify the server is healthy:

```bash
curl http://localhost:5000/api/health

# Expected Response:
# {"status": "ok", "uptime": 1234}
```

### Database Initialization

#### 1. Seed Initial Data (Optional)

```bash
npm run seed
```

This creates:

- Sample menu items and categories
- Ingredient database
- Test users with different roles

#### 2. Create Indexes for Performance

MongoDB automatically creates indexes, but manually optimize:

```bash
# Via MongoDB client
db.orders.createIndex({ "orderDate": -1 });
db.orders.createIndex({ "status": 1 });
db.ingredients.createIndex({ "currentStock": 1 });
```

### Monitoring & Logging

#### Application Logs

```bash
# Enable debug logging
NODE_ENV=development npm run dev 2>&1 | tee app.log

# View specific log level
grep "ERROR" app.log
```

#### Database Monitoring

```bash
# MongoDB native logging
# In connection URI, append: ?retryWrites=true&w=majority

# Monitor active queries
mongo
> use restaurant_db
> db.currentOp()
```

#### Performance Monitoring

- Use New Relic, Datadog, or similar APM tools
- Monitor response times, error rates, and database query performance
- Set up alerts for >5% error rate or >2s response time

---

## Data Models

### Order Model

```typescript
{
  _id: ObjectId,
  items: [{
    menuItem: ObjectId (ref: MenuItem),
    quantity: Number,
    price: Number,
    specialInstructions: String
  }],
  totalAmount: Number,
  status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "cancelled",
  customer: ObjectId (ref: User),
  tableNumber: Number,
  orderType: "dine-in" | "takeaway" | "delivery",
  orderDate: Date,
  inventoryDeduction: {
    status: "pending" | "completed" | "failed" | "skipped",
    data: Mixed,
    warning: String,
    timestamp: Date,
    lastUpdated: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### User Model

```typescript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  password: String (hashed),
  role: "admin" | "manager" | "chef" | "waiter" | "cashier",
  phone: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### MenuItem Model

```typescript
{
  _id: ObjectId,
  name: String (required),
  description: String,
  price: Number (required),
  category: ObjectId (ref: Category),
  ingredients: [{
    ingredientId: ObjectId,
    name: String,
    quantity: Number,
    unit: String
  }],
  isAvailable: Boolean,
  preparationTime: Number (minutes),
  allergens: [String],
  imageUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Ingredient Model

```typescript
{
  _id: ObjectId,
  name: String (required),
  currentStock: Number,
  unit: String,
  minStock: Number,
  reorderPoint: Number,
  supplier: ObjectId (ref: Supplier),
  lastRestocked: Date,
  costPerUnit: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Handling & Validation

### Error Handling Strategy

All operations return a `Result` type:

```typescript
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
```

**Usage:**

```typescript
const result = await service.doSomething();
if (result.ok) {
  const value = result.value; // T
} else {
  const error = result.error; // E
}
```

### Validation

Input validation is performed at multiple levels:

1. **Schema Validation (Mongoose)**

   ```typescript
   const userSchema = new Schema({
     email: { type: String, required: true, match: EMAIL_REGEX },
     password: { type: String, minlength: 8, required: true },
   });
   ```

2. **Controller-Level Validation**
   ```typescript
   export const createOrder = (req: Request, res: Response) => {
     const { items, customer, orderType } = req.body;

     // Validate required fields
     if (!items || items.length === 0) {
       return res.status(400).json({ error: "Order must have items" });
     }

     // Validate item structure
     for (const item of items) {
       if (!item.menuItem || item.quantity <= 0) {
         return res.status(400).json({ error: "Invalid item" });
       }
     }
   };
   ```

### HTTP Status Codes

| Code | Meaning           | Example                  |
| ---- | ----------------- | ------------------------ |
| 200  | OK                | Request successful       |
| 201  | Created           | Resource created         |
| 400  | Bad Request       | Invalid input            |
| 401  | Unauthorized      | Missing/invalid token    |
| 403  | Forbidden         | Insufficient permissions |
| 404  | Not Found         | Resource doesn't exist   |
| 409  | Conflict          | Duplicate entry          |
| 429  | Too Many Requests | Rate limited             |
| 500  | Server Error      | Unexpected error         |

---

## Real-Time Communication

### WebSocket Events

#### Server → Client

**Order-Related:**

- `order_created` - New order placed
- `order_updated` - Order status changed
- `order_ready` - Order ready for pickup
- `order_cancelled` - Order cancelled

**Inventory-Related:**

- `low_stock_alert` - Item below reorder point
- `stock_updated` - Inventory quantity changed

**System-Related:**

- `notification` - System notification
- `error` - Error event

#### Client → Server

- `set_role` - Identify user role
- `user_connected` - User login
- `watch_order` - Subscribe to specific order
- `acknowledge_alert` - Mark alert as read

### Example WebSocket Integration

```typescript
// Client-side (Next.js)
const socket = useSocket();

useEffect(() => {
  if (!socket) return;

  socket.on("order_created", (order) => {
    console.log("New order:", order);
    updateUI(order);
  });

  socket.on("low_stock_alert", (alert) => {
    showNotification(alert);
  });

  return () => {
    socket.off("order_created");
    socket.off("low_stock_alert");
  };
}, [socket]);
```

---

## Security & Authentication

### Authentication Flow

1. **User Registration/Login**
   - Password hashed with bcryptjs
   - JWT token generated and returned
   - Token stored in httpOnly cookie

2. **Token Validation**
   - All protected routes require valid JWT
   - Token expiration checked (7 days)
   - Token refresh available

3. **Authorization**
   - Role-based access control (RBAC)
   - Endpoint-level and resource-level checks

### Password Security

```typescript
// Registration
const hashedPassword = await bcryptjs.hash(password, 10);
user.password = hashedPassword;

// Login
const isValid = await bcryptjs.compare(inputPassword, user.password);
```

### Rate Limiting

Uses Upstash Redis-based rate limiting:

```typescript
// Hard limit: 100 requests per minute per IP
const rateLimit = new Ratelimit({
  redis: client,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
});

const { success } = await rateLimit.limit(req.ip);
if (!success) {
  return res.status(429).json({ error: "Too many requests" });
}
```

### CORS Security

CORS is configured to allow:

- Localhost (development)
- Vercel deployment domains
- Ngrok tunnels (testing)
- Custom origins via environment variable

```typescript
const corsOptions = {
  origin: function (origin, callback) {
    if (ALLOWED_ORIGINS.includes(origin) || isNgrokDomain(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};
```

---

## Appendix: Common Commands

### Development

```bash
npm run dev              # Start development server
npm run build           # Build TypeScript
npm run lint            # Run ESLint
npm test               # Run tests
npm run format         # Format code
```

### Database

```bash
npm run seed           # Seed initial data
npm run migrate:up     # Run migrations
npm run migrate:down   # Rollback migrations
```

### Deployment

```bash
npm run build          # Prepare for production
docker build -t app . # Build Docker image
docker-compose up -d  # Start with Docker Compose
```

---

## Support & Troubleshooting

### Common Issues

**MongoDB Connection Error**

```
Error: MONGODB_URI is not defined
Solution: Add MONGODB_URI to .env file
```

**JWT Token Invalid**

```
Error: Invalid token
Solution: Ensure JWT_SECRET matches between sessions
```

**CORS Policy Violation**

```
Error: Not allowed by CORS
Solution: Add client origin to CORS_ORIGIN in .env
```

**Rate Limit Exceeded**

```
Error: Too many requests (429)
Solution: Wait 1 minute or reduce request frequency
```

---

**End of Backend Restaurant Documentation**
