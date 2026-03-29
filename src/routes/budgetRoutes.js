import { Router } from "express";
import { createBudget, getBudgets, updateBudget } from "../controllers/budgetController.js";

const router = Router();

router.post("/", createBudget);
router.get("/", getBudgets);
router.put("/", updateBudget);

export default router;
