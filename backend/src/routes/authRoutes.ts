import { Router } from "express";
import { registerUser, loginUser, getMe } from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticateToken, getMe);

export default router;