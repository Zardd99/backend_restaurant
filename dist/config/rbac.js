"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAnyPermission = exports.hasPermission = exports.isRole = exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.ROLES = void 0;
exports.ROLES = [
    "admin",
    "manager",
    "chef",
    "waiter",
    "cashier",
    "customer",
];
exports.PERMISSIONS = [
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
    "user:manage",
];
const ALL_PERMISSIONS = [...exports.PERMISSIONS];
exports.ROLE_PERMISSIONS = {
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
    ],
    chef: [
        "menu:read",
        "category:read",
        "inventory:read",
        "order:read",
        "order:status",
        "notification:read",
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
    ],
    cashier: [
        "menu:read",
        "category:read",
        "order:read",
        "billing:read",
        "billing:pay",
        "receipt:read",
        "notification:read",
    ],
    customer: ["menu:read", "category:read", "order:create", "review:write"],
};
const isRole = (value) => typeof value === "string" && exports.ROLES.includes(value);
exports.isRole = isRole;
const hasPermission = (role, permission) => {
    if (!role || !(0, exports.isRole)(role))
        return false;
    return exports.ROLE_PERMISSIONS[role].includes(permission);
};
exports.hasPermission = hasPermission;
const hasAnyPermission = (role, permissions) => permissions.some((permission) => (0, exports.hasPermission)(role, permission));
exports.hasAnyPermission = hasAnyPermission;
//# sourceMappingURL=rbac.js.map