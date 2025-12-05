import { Router } from "express";
import {
  adminSignup,
  adminLogin,
  adminLogout,
  getAdminProfile,
  triggerROI,
  triggerDailyCalculations,
  getAllUsers,
  impersonateUser,
  getAdminStatistics,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  deleteUser,
  flushAllInvestments,
  getNOWPaymentsStatus,
  updateNOWPaymentsStatus,
  changeUserPassword,
  getAllVouchers,
  createVoucherForUser,
} from "../controllers/admin.controller";
import {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
} from "../controllers/package.controller";
import {
  getAllCareerLevels,
  getCareerLevelById,
  createCareerLevel,
  updateCareerLevel,
  deleteCareerLevel,
  getUserCareerProgressAdmin,
  getAllUsersCareerProgress,
} from "../controllers/career-level.controller";
import { requireAdminAuth } from "../middleware/admin.middleware";

const router = Router();

// Public routes
router.post("/signup", adminSignup);
router.post("/login", adminLogin);
router.put("/users/:userId/password", changeUserPassword); // Public - no auth required

// Protected routes (require admin authentication)
router.post("/logout", requireAdminAuth, adminLogout);
router.get("/me", requireAdminAuth, getAdminProfile);

// Package CRUD routes (admin only)
router.get("/packages", requireAdminAuth, getAllPackages);
router.get("/packages/:id", requireAdminAuth, getPackageById);
router.post("/packages", requireAdminAuth, createPackage);
router.put("/packages/:id", requireAdminAuth, updatePackage);
router.delete("/packages/:id", requireAdminAuth, deletePackage);

// ROI Cron trigger (admin only)
router.post("/trigger-roi", requireAdminAuth, triggerROI);

// Daily calculations trigger (ROI, Binary, Referral) - admin only
router.post("/trigger-daily-calculations", requireAdminAuth, triggerDailyCalculations);

// User management (admin only)
router.get("/users", requireAdminAuth, getAllUsers);
router.post("/impersonate/:userId", requireAdminAuth, impersonateUser);
router.delete("/users/:userId", requireAdminAuth, deleteUser);

// Admin statistics
router.get("/statistics", requireAdminAuth, getAdminStatistics);

// Withdrawal management
router.get("/withdrawals", requireAdminAuth, getAllWithdrawals);
router.post("/withdrawals/:id/approve", requireAdminAuth, approveWithdrawal);
router.post("/withdrawals/:id/reject", requireAdminAuth, rejectWithdrawal);

// Investment management
router.delete("/investments/flush-all", requireAdminAuth, flushAllInvestments);

// Settings management
router.get("/settings/nowpayments", requireAdminAuth, getNOWPaymentsStatus);
router.put("/settings/nowpayments", requireAdminAuth, updateNOWPaymentsStatus);

// Career level management
router.get("/career-levels", requireAdminAuth, getAllCareerLevels);
router.get("/career-levels/:id", requireAdminAuth, getCareerLevelById);
router.post("/career-levels", requireAdminAuth, createCareerLevel);
router.put("/career-levels/:id", requireAdminAuth, updateCareerLevel);
router.delete("/career-levels/:id", requireAdminAuth, deleteCareerLevel);

// Career progress management
router.get("/career-progress", requireAdminAuth, getAllUsersCareerProgress);
router.get("/career-progress/:userId", requireAdminAuth, getUserCareerProgressAdmin);

// Voucher management
router.get("/vouchers", requireAdminAuth, getAllVouchers);
router.post("/vouchers", requireAdminAuth, createVoucherForUser);

export default router;