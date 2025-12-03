import { Router } from "express";
import {
  userSignup,
  userLogin,
  userLogout,
  getUserProfile,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.post("/signup", userSignup);
router.post("/login", userLogin);

// Protected routes (require user authentication)
router.post("/logout", requireAuth, userLogout);
router.get("/me", requireAuth, getUserProfile);

export default router;

