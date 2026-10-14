import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * Helper to determine active franchise ID
 */
const getActiveFranchiseId = async (req: AuthRequest): Promise<number | null> => {
    const user = req.user!;
    if (user.role === "franchise" && user.franchise_id) {
        return user.franchise_id;
    }

    if (req.query.franchise_id) {
        return Number(req.query.franchise_id);
    }
    if (req.body.franchise_id) {
        return Number(req.body.franchise_id);
    }

    // Default to the first franchise in system (Bhilwadi)
    const firstFranchise = await pool.query("SELECT id FROM franchises ORDER BY id ASC LIMIT 1");
    return firstFranchise.rows[0]?.id || null;
};

/**
 * 1. GET /api/ledger/summary
 * Returns total given by admin, total given by branch, and who owes whom.
 */
export const getLedgerSummary = async (req: AuthRequest, res: Response) => {
    try {
        const franchiseId = await getActiveFranchiseId(req);
        if (!franchiseId) {
            return res.status(400).json({ message: "Franchise not found" });
        }

        // Fetch franchise details
        const franchiseRes = await pool.query("SELECT id, name, code FROM franchises WHERE id = $1", [franchiseId]);
        const franchise = franchiseRes.rows[0];

        // Calculate Totals:
        // admin_to_branch = Admin gave money to Franchise
        // branch_to_admin = Franchise gave money to Admin
        const totalsRes = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'admin_to_branch' THEN amount ELSE 0 END), 0)::numeric as total_admin_paid,
                COALESCE(SUM(CASE WHEN transaction_type = 'branch_to_admin' THEN amount ELSE 0 END), 0)::numeric as total_branch_paid,
                COUNT(*)::int as total_transactions
             FROM cash_transactions
             WHERE franchise_id = $1`,
            [franchiseId]
        );

        const totalAdminPaid = Number(totalsRes.rows[0]?.total_admin_paid || 0);
        const totalBranchPaid = Number(totalsRes.rows[0]?.total_branch_paid || 0);
        const totalTransactions = Number(totalsRes.rows[0]?.total_transactions || 0);

        let settlementStatus: "branch_owes_admin" | "admin_owes_branch" | "settled" = "settled";
        let difference = 0;
        let settlementText = "हिशोब पूर्ण चुकता (Settled) आहे! कोणाचेही काही देणे बाकी नाही. ✅";
        let badgeColor = "#16A34A";

        if (totalAdminPaid > totalBranchPaid) {
            settlementStatus = "branch_owes_admin";
            difference = totalAdminPaid - totalBranchPaid;
            settlementText = `शाखेने ॲडमिनला ₹ ${difference.toLocaleString("en-IN")} देणे बाकी आहे`;
            badgeColor = "#DC2626";
        } else if (totalBranchPaid > totalAdminPaid) {
            settlementStatus = "admin_owes_branch";
            difference = totalBranchPaid - totalAdminPaid;
            settlementText = `ॲडमिनने शाखेला ₹ ${difference.toLocaleString("en-IN")} देणे बाकी आहे`;
            badgeColor = "#2563EB";
        }

        return res.status(200).json({
            franchise,
            summary: {
                total_admin_paid: totalAdminPaid,
                total_branch_paid: totalBranchPaid,
                difference,
                settlement_status: settlementStatus,
                settlement_text: settlementText,
                badge_color: badgeColor,
                total_transactions: totalTransactions,
            },
        });
    } catch (error: any) {
        console.error("Ledger summary error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * 2. GET /api/ledger/transactions
 * Returns list of cash transactions.
 */
export const getLedgerTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const franchiseId = await getActiveFranchiseId(req);
        if (!franchiseId) {
            return res.status(400).json({ message: "Franchise not found" });
        }

        const { type, start_date, end_date } = req.query;

        let query = `
            SELECT ct.id, ct.franchise_id, ct.recorded_by_user_id,
                   ct.transaction_type, ct.amount, ct.payment_mode,
                   ct.transaction_date, ct.notes, ct.created_at,
                   u.name as recorded_by_name, u.role as recorded_by_role,
                   f.name as franchise_name
            FROM cash_transactions ct
            JOIN users u ON ct.recorded_by_user_id = u.id
            JOIN franchises f ON ct.franchise_id = f.id
            WHERE ct.franchise_id = $1
        `;

        const queryParams: any[] = [franchiseId];
        let paramIdx = 2;

        if (type && (type === "admin_to_branch" || type === "branch_to_admin")) {
            query += ` AND ct.transaction_type = $${paramIdx}`;
            queryParams.push(type);
            paramIdx++;
        }

        if (start_date) {
            query += ` AND ct.transaction_date >= $${paramIdx}`;
            queryParams.push(start_date);
            paramIdx++;
        }

        if (end_date) {
            query += ` AND ct.transaction_date <= $${paramIdx}`;
            queryParams.push(end_date);
            paramIdx++;
        }

        query += ` ORDER BY ct.transaction_date DESC, ct.created_at DESC, ct.id DESC`;

        const result = await pool.query(query, queryParams);

        return res.status(200).json({
            transactions: result.rows,
        });
    } catch (error: any) {
        console.error("Ledger transactions error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * 3. POST /api/ledger/transactions
 * Record a new cash transaction.
 */
export const createLedgerTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const franchiseId = await getActiveFranchiseId(req);

        if (!franchiseId) {
            return res.status(400).json({ message: "Franchise ID is required" });
        }

        const { transaction_type, amount, payment_mode = "cash", transaction_date, notes } = req.body;

        if (!transaction_type || !["admin_to_branch", "branch_to_admin"].includes(transaction_type)) {
            return res.status(400).json({
                message: "Valid transaction_type is required ('admin_to_branch' or 'branch_to_admin')",
            });
        }

        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ message: "Valid positive amount is required" });
        }

        const targetDate = transaction_date || new Date().toISOString().split("T")[0];

        const result = await pool.query(
            `INSERT INTO cash_transactions
                (franchise_id, recorded_by_user_id, transaction_type, amount, payment_mode, transaction_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, franchise_id, recorded_by_user_id, transaction_type, amount, payment_mode, transaction_date, notes, created_at`,
            [franchiseId, user.id, transaction_type, numAmount, payment_mode, targetDate, notes ? notes.trim() : null]
        );

        return res.status(201).json({
            message: "Transaction recorded successfully",
            transaction: result.rows[0],
        });
    } catch (error: any) {
        console.error("Create ledger transaction error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * 4. DELETE /api/ledger/transactions/:id
 * Delete a transaction in case of error.
 */
export const deleteLedgerTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query("DELETE FROM cash_transactions WHERE id = $1 RETURNING id", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        return res.status(200).json({ message: "Transaction deleted successfully" });
    } catch (error: any) {
        console.error("Delete ledger transaction error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
