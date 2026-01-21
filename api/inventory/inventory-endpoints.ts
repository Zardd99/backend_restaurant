import { Router } from "express";
import { InventoryEndpoints } from "../../controllers/inventoryController"; // Adjust path to your class file

const router = Router();
const endpoints = new InventoryEndpoints();

/**
 * Route Mapping
 * We use .bind(endpoints) to ensure 'this' context is preserved
 * for the Dependency Injection inside the class.
 */

// POST /api/inventory/check-availability
router.post("/check-availability", endpoints.checkAvailability.bind(endpoints));

// POST /api/inventory/consume
router.post("/consume", endpoints.consumeIngredients.bind(endpoints));

// POST /api/inventory/preview
router.post("/preview", endpoints.previewDeduction.bind(endpoints));

// GET /api/inventory/stock/:ingredientId
router.get("/stock/:ingredientId", endpoints.getStockLevel.bind(endpoints));

// GET /api/inventory/low-stock
router.get("/low-stock", endpoints.getLowStockAlerts.bind(endpoints));

export default router;
