import { Router } from "express";
import { registerUser, loginUser, getMe, saveFcmToken, getUsers, createUser, deleteUser } from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticateToken, getMe);
router.post("/fcm-token", authenticateToken, saveFcmToken);

// User Management (Admin only)
router.get("/users", authenticateToken, getUsers);
router.post("/users", authenticateToken, createUser);
router.delete("/users/:id", authenticateToken, deleteUser);

export default router;