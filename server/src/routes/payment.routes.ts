import { Router } from "express";
import {
  createPayment,
  handlePaymentCallback,
  getPaymentStatus,
  getPaymentByOrderId,
} from "../controllers/payment.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Create payment (requires authentication)
router.post("/create", requireAuth, createPayment);

// Get payment status (requires authentication)
router.get("/status/:paymentId", requireAuth, getPaymentStatus);

// Get payment by order ID (requires authentication)
router.get("/order/:orderId", requireAuth, getPaymentByOrderId);

// Payment callback/webhook (no auth required - NOWPayments will call this)
router.post("/callback", handlePaymentCallback);

export default router;

