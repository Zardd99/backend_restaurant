"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const tableManagementController_1 = require("../../controllers/tableManagementController");
const router = (0, express_1.Router)();
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.get("/floor-map", (0, auth_1.requirePermission)("table:read"), tableManagementController_1.getFloorMap);
router.post("/auto-assign", (0, auth_1.requirePermission)("table:manage"), tableManagementController_1.autoAssignTable);
router.post("/join", (0, auth_1.requirePermission)("table:manage"), tableManagementController_1.joinTables);
router.post("/split", (0, auth_1.requirePermission)("table:manage"), tableManagementController_1.splitTables);
router.post("/:id/seat", (0, auth_1.requirePermission)("table:manage"), tableManagementController_1.seatGuests);
router.post("/:id/bus", (0, auth_1.requirePermission)("table:manage"), tableManagementController_1.busTable);
exports.default = router;
//# sourceMappingURL=table_routes.js.map