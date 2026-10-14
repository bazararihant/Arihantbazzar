import { Router } from "express";
import multer from "multer";
import path from "path";
import {
    createOrder,
    getOrders,
    getOrderById,
    uploadBill,
    updateOrderStatus,
    getFranchises,
    getDashboardStats,
    toggleItemCheck,
    updateOrderItem,
    addOrderItem,
    deleteOrderItem,
    updateOrder,
    deleteOrder,
    getExpenseReport,
} from "../controllers/orderController";
import { authenticateToken } from "../middleware/authMiddleware";

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

// All order routes require authentication
router.use(authenticateToken);

router.get("/franchises", getFranchises);
router.get("/dashboard/stats", getDashboardStats);
router.get("/reports/expense", getExpenseReport);
router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.put("/:id", updateOrder);
router.delete("/:id", deleteOrder);
router.post("/:id/upload-bill", upload.single("bill"), uploadBill);
router.patch("/:id/status", updateOrderStatus);

// Items sub-routes
router.post("/:id/items", addOrderItem);
router.patch("/:id/items/:itemId/check", toggleItemCheck);
router.put("/:id/items/:itemId", updateOrderItem);
router.delete("/:id/items/:itemId", deleteOrderItem);

export default router;
