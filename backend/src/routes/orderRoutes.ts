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
} from "../controllers/orderController";
import { authenticateToken } from "../middleware/authMiddleware";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, "bill-" + uniqueSuffix + ext);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

// All order routes require authentication
router.use(authenticateToken);

router.get("/franchises", getFranchises);
router.get("/dashboard/stats", getDashboardStats);
router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/:id/upload-bill", upload.single("bill"), uploadBill);
router.patch("/:id/status", updateOrderStatus);

export default router;
