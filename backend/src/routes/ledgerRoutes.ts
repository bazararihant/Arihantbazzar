import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
    getLedgerSummary,
    getLedgerTransactions,
    createLedgerTransaction,
    deleteLedgerTransaction,
} from "../controllers/ledgerController";

const router = Router();

// Protect all ledger routes
router.use(authenticateToken);

// Summary with calculations and settlement status
router.get("/summary", getLedgerSummary);

// List transactions
router.get("/transactions", getLedgerTransactions);

// Record new transaction
router.post("/transactions", createLedgerTransaction);

// Delete transaction
router.delete("/transactions/:id", deleteLedgerTransaction);

export default router;
