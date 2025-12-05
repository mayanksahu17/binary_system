import { Router } from "express";
import {
  getUserWallets,
  getUserPackages,
  createInvestment,
  getUserInvestments,
  getUserBinaryTree,
  getUserTransactions,
  getUserReports,
  createWithdrawal,
  getUserVouchers,
  createVoucher,
  updateWalletAddress,
  getUserReferralLinks,
  exchangeWalletFunds,
  getUserCareerProgressController,
} from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// All routes require user authentication
router.get("/wallets", requireAuth, getUserWallets);
router.get("/packages", requireAuth, getUserPackages);
router.post("/invest", requireAuth, createInvestment);
router.get("/investments", requireAuth, getUserInvestments);
router.get("/binary-tree", requireAuth, getUserBinaryTree);
router.get("/transactions", requireAuth, getUserTransactions);
router.get("/reports", requireAuth, getUserReports);
router.post("/withdraw", requireAuth, createWithdrawal);
router.get("/vouchers", requireAuth, getUserVouchers);
router.post("/vouchers/create", requireAuth, createVoucher);
router.put("/wallet-address", requireAuth, updateWalletAddress);
router.get("/referral-links", requireAuth, getUserReferralLinks);
router.post("/wallet-exchange", requireAuth, exchangeWalletFunds);
router.get("/career-progress", requireAuth, getUserCareerProgressController);

export default router;

