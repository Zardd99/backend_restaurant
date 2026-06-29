import { Router } from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import { authenticate, requirePermission } from "../../middleware/auth";
import {
  autoAssignTable,
  seatGuests,
  busTable,
  joinTables,
  splitTables,
  getFloorMap,
} from "../../controllers/tableManagementController";

// Mounted at /api/tables BEFORE the legacy occupancy router so these explicit
// paths resolve first; unmatched paths fall through to it. The standalone
// `router.use(apiLimiter)` statement is the shape CodeQL's js/missing-rate-limiting
// rule recognizes — do not fold it into a combined `.use(apiLimiter, authenticate)`.
const router = Router();

router.use(apiLimiter);
router.use(authenticate);

router.get("/floor-map", requirePermission("table:read"), getFloorMap);

router.post("/auto-assign", requirePermission("table:manage"), autoAssignTable);
router.post("/join", requirePermission("table:manage"), joinTables);
router.post("/split", requirePermission("table:manage"), splitTables);
router.post("/:id/seat", requirePermission("table:manage"), seatGuests);
router.post("/:id/bus", requirePermission("table:manage"), busTable);

export default router;
