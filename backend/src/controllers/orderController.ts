import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

// 1. Create a new material order with items
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { items, notes, franchise_id } = req.body;
        const user = req.user!;

        // Determine franchise_id: franchise user uses their own; admin can specify
        const targetFranchiseId = user.role === "admin" ? (franchise_id || user.franchise_id) : user.franchise_id;

        if (!targetFranchiseId) {
            return res.status(400).json({
                message: "Franchise ID is required to place an order",
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Order must contain at least one item",
            });
        }

        // Validate items
        for (const item of items) {
            if (!item.item_name || !item.item_name.trim() || !item.quantity || Number(item.quantity) <= 0) {
                return res.status(400).json({
                    message: "Each item must have a valid item_name and quantity greater than 0",
                });
            }
        }

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // Insert into material_orders
            const orderRes = await client.query(
                `INSERT INTO material_orders (franchise_id, user_id, notes, status)
                 VALUES ($1, $2, $3, 'pending')
                 RETURNING id, franchise_id, user_id, order_date, status, notes, created_at`,
                [targetFranchiseId, user.id, notes || ""]
            );
            const order = orderRes.rows[0];

            // Insert each item
            const insertedItems = [];
            for (const item of items) {
                const itemRes = await client.query(
                    `INSERT INTO order_items (order_id, item_name, quantity, unit, notes)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, item_name, quantity, unit, notes`,
                    [
                        order.id,
                        item.item_name.trim(),
                        Number(item.quantity),
                        item.unit ? item.unit.trim().toLowerCase() : "kg",
                        item.notes || null,
                    ]
                );
                insertedItems.push(itemRes.rows[0]);
            }

            await client.query("COMMIT");

            // Fetch franchise details
            const franchiseRes = await pool.query(
                "SELECT name, code FROM franchises WHERE id = $1",
                [targetFranchiseId]
            );

            return res.status(201).json({
                message: "Order placed successfully",
                order: {
                    ...order,
                    franchise_name: franchiseRes.rows[0]?.name,
                    franchise_code: franchiseRes.rows[0]?.code,
                    items: insertedItems,
                },
            });
        } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Create order error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Get list of orders
export const getOrders = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const { franchise_id, status } = req.query;

        let query = `
            SELECT o.id, o.franchise_id, o.order_date, o.status, o.notes,
                   o.bill_image_url, o.bill_amount, o.created_at, o.updated_at,
                   f.name as franchise_name, f.code as franchise_code,
                   u.name as user_name,
                   COUNT(oi.id)::int as total_items
            FROM material_orders o
            JOIN franchises f ON o.franchise_id = f.id
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
        `;

        const conditions: string[] = [];
        const params: any[] = [];

        // If franchise user, strictly filter by their branch
        if (user.role === "franchise") {
            params.push(user.franchise_id);
            conditions.push(`o.franchise_id = $${params.length}`);
        } else if (franchise_id) {
            // Admin can filter by franchise
            params.push(Number(franchise_id));
            conditions.push(`o.franchise_id = $${params.length}`);
        }

        if (status) {
            params.push(status);
            conditions.push(`o.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }

        query += ` GROUP BY o.id, f.id, u.id ORDER BY o.created_at DESC`;

        const result = await pool.query(query, params);
        return res.json({ orders: result.rows });
    } catch (error) {
        console.error("Get orders error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Get single order details with items
export const getOrderById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user!;

        const orderRes = await pool.query(
            `SELECT o.id, o.franchise_id, o.order_date, o.status, o.notes,
                    o.bill_image_url, o.bill_amount, o.created_at, o.updated_at,
                    f.name as franchise_name, f.code as franchise_code, f.address as franchise_address,
                    u.name as user_name, u.email as user_email
             FROM material_orders o
             JOIN franchises f ON o.franchise_id = f.id
             JOIN users u ON o.user_id = u.id
             WHERE o.id = $1`,
            [id]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const order = orderRes.rows[0];

        // Ensure franchise user can only see their branch's order
        if (user.role === "franchise" && order.franchise_id !== user.franchise_id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const itemsRes = await pool.query(
            `SELECT id, item_name, quantity, unit, notes
             FROM order_items
             WHERE order_id = $1
             ORDER BY id ASC`,
            [id]
        );

        return res.json({
            order: {
                ...order,
                items: itemsRes.rows,
            },
        });
    } catch (error) {
        console.error("Get order by id error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Upload bill image for an order
export const uploadBill = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { bill_amount } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "Bill image file is required" });
        }

        // Generate accessible image URL
        const billImageUrl = `/uploads/${file.filename}`;

        const result = await pool.query(
            `UPDATE material_orders
             SET bill_image_url = $1,
                 bill_amount = COALESCE($2, bill_amount),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, bill_image_url, bill_amount, status, updated_at`,
            [billImageUrl, bill_amount ? Number(bill_amount) : null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({
            message: "Bill uploaded successfully",
            order: result.rows[0],
        });
    } catch (error) {
        console.error("Upload bill error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Update order status (Admin or Franchise)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["pending", "approved", "dispatched", "delivered", "rejected"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const result = await pool.query(
            `UPDATE material_orders
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, status, updated_at`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({
            message: `Order status updated to ${status}`,
            order: result.rows[0],
        });
    } catch (error) {
        console.error("Update status error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. Get Franchises list
export const getFranchises = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT id, name, code, address, phone FROM franchises ORDER BY id ASC"
        );
        return res.json({ franchises: result.rows });
    } catch (error) {
        console.error("Get franchises error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 7. Get Dashboard Summary Stats
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const franchiseId = user.role === "franchise" ? user.franchise_id : null;

        let baseWhere = franchiseId ? `WHERE franchise_id = ${franchiseId}` : "";

        const totalOrdersRes = await pool.query(`SELECT COUNT(*)::int as count FROM material_orders ${baseWhere}`);
        const pendingOrdersRes = await pool.query(`SELECT COUNT(*)::int as count FROM material_orders ${baseWhere ? baseWhere + " AND" : "WHERE"} status = 'pending'`);
        const approvedOrdersRes = await pool.query(`SELECT COUNT(*)::int as count FROM material_orders ${baseWhere ? baseWhere + " AND" : "WHERE"} status = 'approved'`);
        const dispatchedOrdersRes = await pool.query(`SELECT COUNT(*)::int as count FROM material_orders ${baseWhere ? baseWhere + " AND" : "WHERE"} status = 'dispatched'`);
        const deliveredOrdersRes = await pool.query(`SELECT COUNT(*)::int as count FROM material_orders ${baseWhere ? baseWhere + " AND" : "WHERE"} status = 'delivered'`);

        // Total franchises count
        const totalFranchisesRes = await pool.query("SELECT COUNT(*)::int as count FROM franchises");

        return res.json({
            stats: {
                totalOrders: totalOrdersRes.rows[0].count,
                pendingOrders: pendingOrdersRes.rows[0].count,
                approvedOrders: approvedOrdersRes.rows[0].count,
                dispatchedOrders: dispatchedOrdersRes.rows[0].count,
                deliveredOrders: deliveredOrdersRes.rows[0].count,
                totalFranchises: totalFranchisesRes.rows[0].count,
            },
        });
    } catch (error) {
        console.error("Get dashboard stats error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
