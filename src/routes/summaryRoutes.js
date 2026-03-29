import { Router } from "express";
import { getFinanceSummary } from "../controllers/summaryController.js";

const router = Router();

router.get("/", getFinanceSummary);

export default router;
