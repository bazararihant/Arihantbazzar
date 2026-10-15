import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role = "franchise", franchise_id } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "User already exists with this email",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, franchise_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, email, role, franchise_id, created_at`,
            [name.trim(), email.toLowerCase().trim(), hashedPassword, role, franchise_id || null]
        );

        return res.status(201).json({
            message: "User registered successfully",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, username, password } = req.body;
        const identifier = (username || email || "").trim();

        if (!identifier || !password) {
            return res.status(400).json({
                message: "वापरकर्ता नाव किंवा मोबाईल आणि पासवर्ड आवश्यक आहे",
            });
        }

        const result = await pool.query(
            `SELECT u.id, u.name, u.username, u.phone, u.email, u.password, u.role, u.franchise_id,
                    f.name as franchise_name, f.code as franchise_code
             FROM users u
             LEFT JOIN franchises f ON u.franchise_id = f.id
             WHERE LOWER(u.email) = LOWER($1)
                OR LOWER(COALESCE(u.username, '')) = LOWER($1)
                OR LOWER(u.name) = LOWER($1)
                OR u.phone = $1`,
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "अवैध वापरकर्ता नाव किंवा पासवर्ड",
            });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(String(password).trim(), user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                message: "अवैध वापरकर्ता नाव किंवा पासवर्ड",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                franchise_id: user.franchise_id,
            },
            process.env.JWT_SECRET as string,
            {
                expiresIn: "30d",
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                phone: user.phone,
                email: user.email,
                role: user.role,
                franchise_id: user.franchise_id,
                franchise_name: user.franchise_name,
                franchise_code: user.franchise_code,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ message: "फक्त ॲडमिनला वापरकर्ते पाहण्याची परवानगी आहे" });
        }

        const result = await pool.query(`
            SELECT u.id, u.name, u.username, u.phone, u.email, u.role, u.franchise_id, u.created_at,
                   f.name as franchise_name, f.code as franchise_code
            FROM users u
            LEFT JOIN franchises f ON u.franchise_id = f.id
            ORDER BY u.id ASC
        `);

        return res.json({ users: result.rows });
    } catch (error) {
        console.error("Get users error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ message: "फक्त ॲडमिनला नवीन युजर जोडण्याची परवानगी आहे" });
        }

        const { name, phone, role = "worker", franchise_id } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                message: "नाव आणि मोबाईल नंबर आवश्यक आहे",
            });
        }

        const cleanPhone = String(phone).trim();
        const cleanName = String(name).trim();
        const username = cleanName.toLowerCase().replace(/\s+/g, "");
        const email = `${username}_${cleanPhone}@arihantbazar.com`;

        // Check if phone or username exists
        const existing = await pool.query(
            "SELECT id FROM users WHERE phone = $1 OR (username IS NOT NULL AND LOWER(username) = $2)",
            [cleanPhone, username]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: "या मोबाईल नंबर किंवा नावाचा युजर आधीपासून अस्तित्वात आहे",
            });
        }

        // Password is the mobile number
        const hashedPassword = await bcrypt.hash(cleanPhone, 10);

        // Default to first franchise if not provided
        let targetFranchiseId = franchise_id;
        if (!targetFranchiseId) {
            const fRes = await pool.query("SELECT id FROM franchises ORDER BY id ASC LIMIT 1");
            targetFranchiseId = fRes.rows[0]?.id || 1;
        }

        const result = await pool.query(
            `INSERT INTO users (name, username, phone, email, password, role, franchise_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, name, username, phone, email, role, franchise_id, created_at`,
            [cleanName, username, cleanPhone, email, hashedPassword, role, targetFranchiseId]
        );

        return res.status(201).json({
            message: "नवीन युजर यशस्वीरित्या जोडला गेला",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Create user error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ message: "फक्त ॲडमिनला युजर डिलीट करण्याची परवानगी आहे" });
        }

        const { id } = req.params;
        const targetUserId = Number(id);

        if (targetUserId === req.user.id) {
            return res.status(400).json({ message: "तुम्ही स्वतःचे ॲडमिन खाते डिलीट करू शकत नाही" });
        }

        // Check if user exists
        const userRes = await pool.query("SELECT id, role, name FROM users WHERE id = $1", [targetUserId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "युजर सापडला नाही" });
        }

        await pool.query("DELETE FROM users WHERE id = $1", [targetUserId]);

        return res.json({
            message: `युजर '${userRes.rows[0].name}' यशस्वीरित्या डिलीट केला गेला`,
        });
    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, u.franchise_id,
                    f.name as franchise_name, f.code as franchise_code
             FROM users u
             LEFT JOIN franchises f ON u.franchise_id = f.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ user: result.rows[0] });
    } catch (error) {
        console.error("GetMe error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const saveFcmToken = async (req: AuthRequest, res: Response) => {
    try {
        const { fcm_token, device_type = "android" } = req.body;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!fcm_token) {
            return res.status(400).json({ message: "fcm_token is required" });
        }

        await pool.query(
            `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_type, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, fcm_token)
             DO UPDATE SET updated_at = CURRENT_TIMESTAMP, device_type = $3`,
            [user.id, fcm_token, device_type]
        );

        return res.json({ message: "FCM token saved successfully" });
    } catch (error) {
        console.error("Save FCM token error:", error);
        return res.status(500).json({ message: "Failed to save FCM token" });
    }
};

