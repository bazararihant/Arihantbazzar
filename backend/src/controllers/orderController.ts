import { Response } from "express";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";
import { sendPushNotificationToAdmins, sendPushNotificationToFranchise } from "../services/notificationService";


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

            const franchiseName = franchiseRes.rows[0]?.name || "शाखा";

            // Trigger Push Notification to Admin(s)
            sendPushNotificationToAdmins({
                title: "🔔 नवीन ऑर्डर प्राप्त!",
                body: `${franchiseName} ने नवीन ऑर्डर #${order.id} टाकली आहे (${insertedItems.length} वस्तू).`,
                orderId: order.id,
                type: "NEW_ORDER",
            }).catch((err) => console.error("Notification trigger error:", err));

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
        const { franchise_id, status, today, date, start_date, end_date } = req.query;

        let query = `
            SELECT o.id, o.franchise_id, o.order_date, o.status, o.notes,
                   o.bill_image_url, o.bill_amount, o.created_at, o.updated_at,
                   f.name as franchise_name, f.code as franchise_code,
                   u.name as user_name, u.role as user_role,
                   COUNT(oi.id)::int as total_items
            FROM material_orders o
            JOIN franchises f ON o.franchise_id = f.id
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
        `;

        const conditions: string[] = [];
        const params: any[] = [];

        // If not admin, strictly filter by their branch
        if (user.role !== "admin") {
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

        // Today filter
        if (today === "true" || String(today) === "true" || date === "today") {
            conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
        } else if (date) {
            params.push(date);
            conditions.push(`DATE(o.created_at) = $${params.length}`);
        } else {
            if (start_date) {
                params.push(start_date);
                conditions.push(`DATE(o.created_at) >= $${params.length}`);
            }
            if (end_date) {
                params.push(end_date);
                conditions.push(`DATE(o.created_at) <= $${params.length}`);
            }
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }

        query += ` GROUP BY o.id, f.id, u.id ORDER BY o.created_at DESC`;

        const result = await pool.query(query, params);

        // Only Admin can see bill amounts and bill images
        const sanitizedOrders = result.rows.map((row: any) => {
            if (user.role !== "admin") {
                return {
                    ...row,
                    bill_amount: null,
                    bill_image_url: null,
                };
            }
            return row;
        });

        return res.json({ orders: sanitizedOrders });
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
            `SELECT o.id, o.franchise_id, o.user_id, o.order_date, o.status, o.notes,
                    o.bill_image_url, o.bill_amount, o.created_at, o.updated_at,
                    f.name as franchise_name, f.code as franchise_code, f.address as franchise_address,
                    u.name as user_name, u.role as user_role, u.phone as user_phone, u.email as user_email
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

        // Ensure branch users can only see their branch's order
        if (user.role !== "admin" && order.franchise_id !== user.franchise_id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Hide bill information from all non-admin users (Manager, Worker, Franchise)
        if (user.role !== "admin") {
            order.bill_amount = null;
            order.bill_image_url = null;
        }

        const itemsRes = await pool.query(
            `SELECT id, item_name, quantity, unit, notes, COALESCE(is_checked, false) as is_checked
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
        const { bill_amount, image_base64 } = req.body;
        const file = req.file;

        if (!file && !image_base64) {
            return res.status(400).json({ message: "Bill image file or image_base64 is required" });
        }

        let billImageUrl = "";

        if (file) {
            const ext = path.extname(file.originalname) || ".jpg";
            const filename = `bill-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            let savedToDisk = false;

            // Attempt to write physical file to uploads/ folder (for local server/storage)
            try {
                const uploadsDir = path.join(__dirname, "../../uploads");
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
                savedToDisk = true;
            } catch (diskErr) {
                console.warn("[Upload] Could not write to disk (likely serverless/Vercel):", diskErr);
            }

            // If running on a persistent server, serve via /uploads/
            // Otherwise use Data URL so Vercel / Cloud never loses the image
            const mimeType = file.mimetype || "image/jpeg";
            billImageUrl = savedToDisk
                ? `/uploads/${filename}`
                : `data:${mimeType};base64,${file.buffer.toString("base64")}`;
        } else if (image_base64) {
            billImageUrl = image_base64;

            // Try to write to disk if possible
            try {
                const uploadsDir = path.join(__dirname, "../../uploads");
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                const filename = `bill-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
                const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
                fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(base64Data, "base64"));
            } catch (diskErr) {
                // Ignore on serverless
            }
        }

        const result = await pool.query(
            `UPDATE material_orders
             SET bill_image_url = $1,
                 bill_amount = COALESCE($2, bill_amount),
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, franchise_id, bill_image_url, bill_amount, status, updated_at`,
            [billImageUrl, bill_amount ? Number(bill_amount) : null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const updatedOrder = result.rows[0];

        // Notify franchise that bill has been uploaded
        if (updatedOrder.franchise_id) {
            sendPushNotificationToFranchise(updatedOrder.franchise_id, {
                title: "📄 बिल अपलोड झाले आहे",
                body: `तुमच्या ऑर्डर #${id} चे बिल ॲडमिनने अपलोड केले आहे.`,
                orderId: Number(id),
                type: "BILL_UPLOADED",
            }).catch((err) => console.error("Franchise bill notification error:", err));
        }

        return res.json({
            message: "Bill uploaded successfully",
            order: updatedOrder,
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
             RETURNING id, franchise_id, status, updated_at`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        const updatedOrder = result.rows[0];

        // Notify franchise when status changes
        if (updatedOrder.franchise_id) {
            const statusLabels: Record<string, string> = {
                approved: "मंजूर करण्यात आली आहे ✅",
                dispatched: "पाठवण्यात आली आहे (Dispatched) 🚚",
                delivered: "वितरित झाली आहे (Delivered) 🎉",
                rejected: "नाकारण्यात आली आहे ❌",
                pending: "प्रलंबित आहे ⏳",
            };
            const label = statusLabels[status] || status;
            sendPushNotificationToFranchise(updatedOrder.franchise_id, {
                title: "📦 ऑर्डर स्टेटस अपडेट",
                body: `तुमची ऑर्डर #${id} ${label}`,
                orderId: Number(id),
                type: "ORDER_STATUS_UPDATE",
            }).catch((err) => console.error("Franchise status notification error:", err));
        }

        return res.json({
            message: `Order status updated to ${status}`,
            order: updatedOrder,
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

// 8. Toggle / Set Item Checked status (for Admin and Branch Checklist)
export const toggleItemCheck = async (req: AuthRequest, res: Response) => {
    try {
        const { id, itemId } = req.params;
        const { is_checked } = req.body;

        const result = await pool.query(
            `UPDATE order_items 
             SET is_checked = COALESCE($1, NOT COALESCE(is_checked, false))
             WHERE id = $2 AND order_id = $3
             RETURNING id, order_id, item_name, quantity, unit, notes, is_checked`,
            [typeof is_checked === "boolean" ? is_checked : null, itemId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Item not found in this order" });
        }

        return res.json({
            message: "Item check status updated",
            item: result.rows[0],
        });
    } catch (error) {
        console.error("Toggle item check error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 9. Update an order item (Admin or Order Owner)
export const updateOrderItem = async (req: AuthRequest, res: Response) => {
    try {
        const { id, itemId } = req.params;
        const { item_name, quantity, unit, notes } = req.body;

        if (quantity !== undefined && Number(quantity) <= 0) {
            return res.status(400).json({ message: "Quantity must be greater than 0" });
        }

        const result = await pool.query(
            `UPDATE order_items
             SET item_name = COALESCE($1, item_name),
                 quantity = COALESCE($2, quantity),
                 unit = COALESCE($3, unit),
                 notes = COALESCE($4, notes)
             WHERE id = $5 AND order_id = $6
             RETURNING id, order_id, item_name, quantity, unit, notes, is_checked`,
            [
                item_name ? item_name.trim() : null,
                quantity !== undefined ? Number(quantity) : null,
                unit ? unit.trim().toLowerCase() : null,
                notes !== undefined ? notes : null,
                itemId,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json({
            message: "Item updated successfully",
            item: result.rows[0],
        });
    } catch (error) {
        console.error("Update order item error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 10. Add an item to an existing order
export const addOrderItem = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { item_name, quantity, unit, notes } = req.body;

        if (!item_name || !item_name.trim() || !quantity || Number(quantity) <= 0) {
            return res.status(400).json({
                message: "Valid item_name and quantity greater than 0 are required",
            });
        }

        const result = await pool.query(
            `INSERT INTO order_items (order_id, item_name, quantity, unit, notes, is_checked)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, order_id, item_name, quantity, unit, notes, is_checked`,
            [
                id,
                item_name.trim(),
                Number(quantity),
                unit ? unit.trim().toLowerCase() : "kg",
                notes || null,
            ]
        );

        return res.status(201).json({
            message: "Item added to order successfully",
            item: result.rows[0],
        });
    } catch (error) {
        console.error("Add order item error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 11. Delete an item from an order
export const deleteOrderItem = async (req: AuthRequest, res: Response) => {
    try {
        const { id, itemId } = req.params;

        const countRes = await pool.query(
            "SELECT COUNT(*)::int as count FROM order_items WHERE order_id = $1",
            [id]
        );
        if (countRes.rows[0].count <= 1) {
            await pool.query("DELETE FROM material_orders WHERE id = $1", [id]);
            return res.json({
                message: "Last item removed and order deleted successfully",
                orderDeleted: true,
            });
        }

        const result = await pool.query(
            "DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING id",
            [itemId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Delete order item error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 12. Update order general details (e.g. notes)
export const updateOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { notes, status, bill_amount } = req.body;

        const result = await pool.query(
            `UPDATE material_orders
             SET notes = COALESCE($1, notes),
                 status = COALESCE($2, status),
                 bill_amount = COALESCE($3, bill_amount),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, franchise_id, status, notes, bill_amount, updated_at`,
            [
                notes !== undefined ? notes : null,
                status || null,
                bill_amount !== undefined && bill_amount !== "" ? Number(bill_amount) : null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({
            message: "Order updated successfully",
            order: result.rows[0],
        });
    } catch (error) {
        console.error("Update order error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 13. Delete an order
export const deleteOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM material_orders WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error("Delete order error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 14. Monthly & Custom Date Range Expense Report
export const getExpenseReport = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ message: "केवळ मुख्य ॲडमिनला खर्चाचा हिशोब पाहण्याची परवानगी आहे." });
        }

        const { start_date, end_date, month, year } = req.query;
        let query = `
            SELECT 
                COUNT(o.id)::int as total_orders,
                COALESCE(SUM(o.bill_amount), 0)::numeric as total_expense,
                COALESCE(ROUND(AVG(NULLIF(o.bill_amount, 0)), 2), 0)::numeric as avg_expense,
                COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::int as delivered_orders,
                COUNT(CASE WHEN o.status = 'pending' THEN 1 END)::int as pending_orders,
                COUNT(CASE WHEN o.bill_image_url IS NOT NULL OR o.bill_amount > 0 THEN 1 END)::int as billed_orders
            FROM material_orders o
        `;
        const conditions: string[] = [];
        const params: any[] = [];

        const user = req.user;
        if (user && user.role === "franchise" && user.franchise_id) {
            params.push(user.franchise_id);
            conditions.push(`o.franchise_id = $${params.length}`);
        } else if (req.query && req.query.franchise_id) {
            params.push(Number(req.query.franchise_id));
            conditions.push(`o.franchise_id = $${params.length}`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`DATE(o.created_at) >= $${params.length}`);
        }
        if (end_date) {
            params.push(end_date);
            conditions.push(`DATE(o.created_at) <= $${params.length}`);
        }
        if (month && year) {
            params.push(Number(month));
            conditions.push(`EXTRACT(MONTH FROM o.created_at) = $${params.length}`);
            params.push(Number(year));
            conditions.push(`EXTRACT(YEAR FROM o.created_at) = $${params.length}`);
        } else if (year) {
            params.push(Number(year));
            conditions.push(`EXTRACT(YEAR FROM o.created_at) = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        const summaryRes = await pool.query(query, params);

        // Daily breakdown
        let dailyQuery = `
            SELECT 
                DATE(o.created_at)::text as date,
                COUNT(o.id)::int as orders_count,
                COALESCE(SUM(o.bill_amount), 0)::numeric as daily_expense
            FROM material_orders o
        `;
        if (conditions.length > 0) {
            dailyQuery += " WHERE " + conditions.join(" AND ");
        }
        dailyQuery += " GROUP BY DATE(o.created_at) ORDER BY DATE(o.created_at) DESC";
        const dailyRes = await pool.query(dailyQuery, params);

        // Top items breakdown
        let itemsQuery = `
            SELECT 
                oi.item_name,
                oi.unit,
                SUM(oi.quantity)::numeric as total_quantity,
                COUNT(DISTINCT oi.order_id)::int as orders_count
            FROM order_items oi
            JOIN material_orders o ON o.id = oi.order_id
        `;
        if (conditions.length > 0) {
            itemsQuery += " WHERE " + conditions.join(" AND ");
        }
        itemsQuery += " GROUP BY oi.item_name, oi.unit ORDER BY total_quantity DESC LIMIT 10";
        const itemsRes = await pool.query(itemsQuery, params);

        return res.json({
            summary: summaryRes.rows[0],
            daily: dailyRes.rows,
            topItems: itemsRes.rows,
        });
    } catch (error: any) {
        console.error("Get expense report error:", error);
        return res.status(500).json({ message: error?.message || "Internal server error" });
    }
};

