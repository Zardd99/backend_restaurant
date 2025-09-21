import express from "express";
import * as supplierController from "../../controllers/supplierController";

const router = express.Router();

router.get("/", supplierController.getAllSuppliers);
router.get("/:id", supplierController.getSupplierById);
router.post("/", supplierController.createSupplier);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);
router.get("/:id/performance", supplierController.getSupplierPerformance);
router.get("/:id/low-stock", supplierController.getSupplierLowStockAlerts);
router.get("/:id/orders", supplierController.getSupplierOrders);

export default router;
