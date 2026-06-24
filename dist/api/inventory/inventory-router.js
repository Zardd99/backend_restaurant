"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../../controllers/inventoryController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const canCheckStock = (0, auth_1.requirePermission)("inventory:read", "order:create", "order:update", "order:status");
const canDeductStock = (0, auth_1.requirePermission)("inventory:write", "order:create", "order:update", "order:status");
const canReadInventory = (0, auth_1.requirePermission)("inventory:read");
const canWriteInventory = (0, auth_1.requirePermission)("inventory:write");
let endpointsInstance = null;
const getEndpoints = () => {
    if (!endpointsInstance) {
        console.log("🔄 Creating InventoryEndpoints instance...");
        endpointsInstance = new inventoryController_1.InventoryEndpoints();
    }
    return endpointsInstance;
};
router.post("/check-availability", canCheckStock, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.checkAvailability(req, res);
    }
    catch (error) {
        console.error("Error in check-availability route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/consume", canDeductStock, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.consumeIngredients(req, res);
    }
    catch (error) {
        console.error("Error in consume route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/preview", canCheckStock, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.previewDeduction(req, res);
    }
    catch (error) {
        console.error("Error in preview route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/stock/:ingredientId", canReadInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getStockLevels(req, res);
    }
    catch (error) {
        console.error("Error in stock route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/low-stock", canReadInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getLowStockAlerts(req, res);
    }
    catch (error) {
        console.error("Error in low-stock route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/dashboard", canReadInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getDashboardData(req, res);
    }
    catch (error) {
        console.error("Error in dashboard route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/stock-levels", canReadInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getStockLevels(req, res);
    }
    catch (error) {
        console.error("Error in stock-levels route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/stock", canWriteInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.updateStock(req, res);
    }
    catch (error) {
        console.error("Error in stock update route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/reorder", canWriteInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.reorderIngredient(req, res);
    }
    catch (error) {
        console.error("Error in reorder route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/bulk-update", canWriteInventory, async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.bulkUpdate(req, res);
    }
    catch (error) {
        console.error("Error in bulk-update route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/ingredients", canReadInventory, async (req, res) => {
    try {
        await getEndpoints().listIngredients(req, res);
    }
    catch (error) {
        console.error("Error in list ingredients route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/ingredients", canWriteInventory, async (req, res) => {
    try {
        await getEndpoints().createIngredient(req, res);
    }
    catch (error) {
        console.error("Error in create ingredient route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/ingredients/:id", canWriteInventory, async (req, res) => {
    try {
        await getEndpoints().updateIngredient(req, res);
    }
    catch (error) {
        console.error("Error in update ingredient route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.delete("/ingredients/:id", canWriteInventory, async (req, res) => {
    try {
        await getEndpoints().deleteIngredient(req, res);
    }
    catch (error) {
        console.error("Error in delete ingredient route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/ingredients/:id/adjust", canWriteInventory, async (req, res) => {
    try {
        await getEndpoints().adjustStock(req, res);
    }
    catch (error) {
        console.error("Error in adjust stock route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/check-low-stock", canReadInventory, async (req, res) => {
    res.json({
        ok: true,
        value: {
            message: "Low stock checks are now automatic. Use GET /low-stock for current alerts.",
            checkInterval: process.env.ALERT_INTERVAL || 60,
        },
    });
});
exports.default = router;
//# sourceMappingURL=inventory-router.js.map