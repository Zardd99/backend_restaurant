"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../../controllers/inventoryController");
const router = (0, express_1.Router)();
let endpointsInstance = null;
const getEndpoints = () => {
    if (!endpointsInstance) {
        console.log("🔄 Creating InventoryEndpoints instance...");
        endpointsInstance = new inventoryController_1.InventoryEndpoints();
    }
    return endpointsInstance;
};
router.post("/check-availability", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.checkAvailability(req, res);
    }
    catch (error) {
        console.error("Error in check-availability route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/consume", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.consumeIngredients(req, res);
    }
    catch (error) {
        console.error("Error in consume route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/preview", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.previewDeduction(req, res);
    }
    catch (error) {
        console.error("Error in preview route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/stock/:ingredientId", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getStockLevels(req, res);
    }
    catch (error) {
        console.error("Error in stock route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/low-stock", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getLowStockAlerts(req, res);
    }
    catch (error) {
        console.error("Error in low-stock route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/dashboard", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getDashboardData(req, res);
    }
    catch (error) {
        console.error("Error in dashboard route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/stock-levels", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.getStockLevels(req, res);
    }
    catch (error) {
        console.error("Error in stock-levels route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/stock", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.updateStock(req, res);
    }
    catch (error) {
        console.error("Error in stock update route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/reorder", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.reorderIngredient(req, res);
    }
    catch (error) {
        console.error("Error in reorder route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/bulk-update", async (req, res) => {
    try {
        const endpoints = getEndpoints();
        await endpoints.bulkUpdate(req, res);
    }
    catch (error) {
        console.error("Error in bulk-update route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/check-low-stock", async (req, res) => {
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