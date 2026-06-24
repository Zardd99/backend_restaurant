"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middleware/auth");
const Promotion_1 = __importDefault(require("../../models/Promotion"));
const router = express_1.default.Router();
router.get("/active", async (req, res) => {
    try {
        const now = new Date();
        const activePromotions = await Promotion_1.default.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        }).select("name description discountType discountValue appliesTo targetIds");
        res.json(activePromotions);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch active promotions" });
    }
});
router.use(auth_1.authenticate);
router.get("/", (0, auth_1.requirePermission)("promotion:manage"), async (req, res) => {
    try {
        const promotions = await Promotion_1.default.find({})
            .populate("createdBy", "name email")
            .sort({ startDate: -1 });
        res.json(promotions);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch promotions" });
    }
});
router.get("/:id", (0, auth_1.requirePermission)("promotion:manage"), async (req, res) => {
    try {
        const promotion = await Promotion_1.default.findById(req.params.id).populate("createdBy", "name email");
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }
        res.json(promotion);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch promotion" });
    }
});
router.post("/", (0, auth_1.requirePermission)("promotion:manage"), async (req, res) => {
    try {
        const { name, description, discountType, discountValue, appliesTo, targetIds, startDate, endDate, minimumOrderAmount, maxUsagePerCustomer, } = req.body;
        if (!name ||
            !discountType ||
            !discountValue ||
            !appliesTo ||
            !startDate ||
            !endDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (discountType === "percentage" &&
            (discountValue < 0 || discountValue > 100)) {
            return res
                .status(400)
                .json({ error: "Percentage discount must be between 0 and 100" });
        }
        if (new Date(startDate) > new Date(endDate)) {
            return res
                .status(400)
                .json({ error: "Start date must be before end date" });
        }
        const promotion = await Promotion_1.default.create({
            name,
            description,
            discountType,
            discountValue,
            appliesTo,
            targetIds: targetIds || [],
            startDate,
            endDate,
            minimumOrderAmount,
            maxUsagePerCustomer,
            createdBy: req.user._id,
        });
        res.status(201).json(promotion);
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "Promotion name already exists" });
        }
        res.status(500).json({ error: "Failed to create promotion" });
    }
});
router.put("/:id", (0, auth_1.requirePermission)("promotion:manage"), async (req, res) => {
    try {
        const { name, description, discountType, discountValue, appliesTo, targetIds, startDate, endDate, isActive, minimumOrderAmount, maxUsagePerCustomer, } = req.body;
        if (discountValue !== undefined &&
            discountType === "percentage" &&
            (discountValue < 0 || discountValue > 100)) {
            return res
                .status(400)
                .json({ error: "Percentage discount must be between 0 and 100" });
        }
        const promotion = await Promotion_1.default.findByIdAndUpdate(req.params.id, {
            name,
            description,
            discountType,
            discountValue,
            appliesTo,
            targetIds,
            startDate,
            endDate,
            isActive,
            minimumOrderAmount,
            maxUsagePerCustomer,
        }, { new: true, runValidators: true });
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }
        res.json(promotion);
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "Promotion name already exists" });
        }
        res.status(500).json({ error: "Failed to update promotion" });
    }
});
router.delete("/:id", (0, auth_1.requirePermission)("promotion:manage"), async (req, res) => {
    try {
        const promotion = await Promotion_1.default.findByIdAndDelete(req.params.id);
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }
        res.json({ message: "Promotion deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete promotion" });
    }
});
exports.default = router;
//# sourceMappingURL=promotions.js.map