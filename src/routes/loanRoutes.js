import { Router } from "express";
import { createLoan, deleteLoan, getLoans, updateLoan } from "../controllers/loanController.js";

const router = Router();

router.post("/", createLoan);
router.get("/", getLoans);
router.put("/:id", updateLoan);
router.delete("/:id", deleteLoan);

export default router;
