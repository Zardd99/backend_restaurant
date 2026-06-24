import express from "express";
import * as supplierController from "../../controllers/supplierController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("supplier:read"),
  supplierController.getAllSuppliers,
);
router.get(
  "/:id",
  requirePermission("supplier:read"),
  supplierController.getSupplierById,
);
router.post(
  "/",
  requirePermission("supplier:write"),
  supplierController.createSupplier,
);
router.put(
  "/:id",
  requirePermission("supplier:write"),
  supplierController.updateSupplier,
);
router.delete(
  "/:id",
  requirePermission("supplier:write"),
  supplierController.deleteSupplier,
);
router.get(
  "/:id/performance",
  requirePermission("supplier:read"),
  supplierController.getSupplierPerformance,
);
router.get(
  "/:id/low-stock",
  requirePermission("supplier:read"),
  supplierController.getSupplierLowStockAlerts,
);
router.get(
  "/:id/orders",
  requirePermission("supplier:read"),
  supplierController.getSupplierOrders,
);

export default router;
