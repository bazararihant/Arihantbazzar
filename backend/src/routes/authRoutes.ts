import { Router } from "express";
import { registerUser, loginUser, getMe, saveFcmToken } from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticateToken, getMe);
router.post("/fcm-token", authenticateToken, saveFcmToken);

export default router;