import { Router } from "express";
import {
  userSignup,
  userLogin,
  userLogout,
  getUserProfile,
  verifyLoginToken,
  forgotPassword,
  resetPassword,
  validateReferrer,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.post("/signup", userSignup);
router.post("/login", userLogin);
router.post("/verify-login-token", verifyLoginToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/validate-referrer/:referrerId", validateReferrer);

// Protected routes (require user authentication)
router.post("/logout", requireAuth, userLogout);
router.get("/me", requireAuth, getUserProfile);

export default router;

