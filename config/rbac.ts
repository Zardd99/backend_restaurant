/**
 * Centralized Role-Based Access Control (RBAC).
 *
 * Single source of truth for what each role is allowed to do. Routers depend on
 * permissions (not role literals) via the `requirePermission` middleware so the
 * access model lives in one place and stays auditable.
 *
 * The matrix mirrored on the frontend (app/config/rbac.ts) is for UI gating only
 * — this file is the authoritative server-side enforcement.
 */

export const ROLES = [
  "admin",
  "manager",
  "chef",
  "waiter",
  "cashier",
  "customer",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Menu & categories
  "menu:read",
  "menu:write",
  "category:read",
  "category:write",
  // Inventory
  "inventory:read",
  "inventory:write",
  // Suppliers
  "supplier:read",
  "supplier:write",
  // Orders
  "order:read",
  "order:create",
  "order:update",
  "order:delete",
  "order:status",
  // Billing & receipts
  "billing:read",
  "billing:pay",
  "receipt:read",
  "receipt:list",
  "receipt:write",
  // Tables
  "table:read",
  "table:manage",
  // Promotions & pricing
  "promotion:manage",
  "price:read",
  // Reviews
  "review:read",
  "review:write",
  // Notifications
  "notification:read",
  "notification:manage",
  // Users (staff administration)
  "user:manage",
  // P2 operational features
  "order:void",
  "order:comp",
  "shift:manage",
  "audit:read",
  // P3 enterprise operations
  "kds:read",
  "kds:manage",
  "inventory:waste",
  "analytics:read",
  "sync:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,

  manager: [
    "menu:read",
    "menu:write",
    "category:read",
    "category:write",
    "inventory:read",
    "inventory:write",
    "supplier:read",
    "supplier:write",
    "order:read",
    "order:create",
    "order:update",
    "order:delete",
    "order:status",
    "billing:read",
    "billing:pay",
    "receipt:read",
    "receipt:list",
    "receipt:write",
    "table:read",
    "table:manage",
    "promotion:manage",
    "price:read",
    "review:read",
    "review:write",
    "notification:read",
    "notification:manage",
    "order:void",
    "order:comp",
    "shift:manage",
    "audit:read",
    "kds:read",
    "kds:manage",
    "inventory:waste",
    "analytics:read",
    "sync:write",
  ],

  chef: [
    "menu:read",
    "category:read",
    "inventory:read",
    "order:read",
    "order:status",
    "notification:read",
    "kds:read",
    "kds:manage",
    "inventory:waste",
  ],

  waiter: [
    "menu:read",
    "category:read",
    "order:read",
    "order:create",
    "order:update",
    "order:status",
    "billing:read",
    "billing:pay",
    "receipt:read",
    "table:read",
    "table:manage",
    "notification:read",
    "kds:read",
    "sync:write",
  ],

  cashier: [
    "menu:read",
    "category:read",
    "order:read",
    "billing:read",
    "billing:pay",
    "receipt:read",
    "notification:read",
    "shift:manage",
  ],

  customer: ["menu:read", "category:read", "order:create", "review:write"],
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export const hasPermission = (
  role: string | undefined,
  permission: Permission,
): boolean => {
  if (!role || !isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
};

export const hasAnyPermission = (
  role: string | undefined,
  permissions: Permission[],
): boolean => permissions.some((permission) => hasPermission(role, permission));
