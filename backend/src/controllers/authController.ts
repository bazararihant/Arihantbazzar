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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.password, u.role, u.franchise_id,
                    f.name as franchise_name, f.code as franchise_code
             FROM users u
             LEFT JOIN franchises f ON u.franchise_id = f.id
             WHERE LOWER(u.email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
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
