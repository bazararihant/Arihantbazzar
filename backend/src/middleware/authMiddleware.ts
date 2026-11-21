import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "arihant_bazzar_secure_jwt_token_2026";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    franchise_id?: number | null;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication token required",
        expired: false,
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as {
      id: number;
      email: string;
      role: string;
      franchise_id?: number | null;
    };

    req.user = decoded;

    next();
  } catch (error: any) {
    const isExpired = error?.name === "TokenExpiredError";
    return res.status(401).json({
      message: isExpired
        ? "सेशन संपले आहे (Token Expired). कृपया पुन्हा लॉगिन करा."
        : "Invalid or expired token",
      expired: isExpired,
    });
  }
};
