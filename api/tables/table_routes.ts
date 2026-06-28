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

// Mounted at /api/tables. Registered BEFORE the legacy occupancy router so these
// explicit paths resolve first; any unmatched path falls through to it. Auth and
// rate limiting are applied per-route (not via router.use) so requests destined
// for the legacy router aren't double-authenticated on fall-through.
const router = Router();

const guard = (permission: "table:read" | "table:manage") => [
  apiLimiter,
  authenticate,
  requirePermission(permission),
];

router.get("/floor-map", guard("table:read"), getFloorMap);

router.post("/auto-assign", guard("table:manage"), autoAssignTable);
router.post("/join", guard("table:manage"), joinTables);
router.post("/split", guard("table:manage"), splitTables);
router.post("/:id/seat", guard("table:manage"), seatGuests);
router.post("/:id/bus", guard("table:manage"), busTable);

export default router;
