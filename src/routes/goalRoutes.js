import { Router } from "express";
import {
  createGoal,
  deleteGoal,
  getGoals,
  updateGoal
} from "../controllers/goalController.js";

const router = Router();

router.post("/", createGoal);
router.get("/", getGoals);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;
