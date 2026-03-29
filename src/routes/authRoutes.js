import { Router } from "express";
import { getSession } from "../controllers/authController.js";

const router = Router();

router.get("/session", getSession);

export default router;
