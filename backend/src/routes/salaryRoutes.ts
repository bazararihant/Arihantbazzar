import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  getWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  getAttendanceByDate,
  saveAttendance,
  getAdvances,
  addAdvance,
  deleteAdvance,
  getSalaryReport,
  recordSettlement,
  getSettlements,
} from "../controllers/salaryController";

const router = Router();

// Protect all salary routes
router.use(authenticateToken);

// 1. Worker management
router.get("/", getWorkers);
router.post("/", createWorker);
router.put("/:id", updateWorker);
router.delete("/:id", deleteWorker);

// 2. Attendance
router.get("/attendance/by-date", getAttendanceByDate);
router.post("/attendance", saveAttendance);

// 3. Advances (उचल)
router.get("/advances/list", getAdvances);
router.post("/advances", addAdvance);
router.delete("/advances/:id", deleteAdvance);

// 4. Reports (Monthly & Custom Date Range)
router.get("/reports/summary", getSalaryReport);

// 5. Settlements (पगार जमा / चुकता)
router.get("/settlements/list", getSettlements);
router.post("/settlements", recordSettlement);

export default router;
