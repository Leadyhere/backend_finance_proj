import { Router } from "express";
import {
  createInvestment,
  deleteInvestment,
  getInvestments,
  updateInvestment
} from "../controllers/investmentController.js";

const router = Router();

router.post("/", createInvestment);
router.get("/", getInvestments);
router.put("/:id", updateInvestment);
router.delete("/:id", deleteInvestment);

export default router;
