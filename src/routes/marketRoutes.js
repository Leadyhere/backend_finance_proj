import { Router } from "express";
import { getMarketOverview } from "../controllers/marketController.js";

const router = Router();

router.get("/", getMarketOverview);

export default router;
