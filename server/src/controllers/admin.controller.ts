import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { signAdminToken, signAuthToken } from "../utills/jwt";
import { Admin } from "../models/Admin";
import { AdminRole } from "../models/Admin";
import { triggerROICalculation } from "../cron/roi-cron";
import { calculateDailyROI, deactivateExpiredInvestments } from "../services/roi-cron.service";
import { Investment } from "../models/Investment";
import { User } from "../models/User";
import { Package } from "../models/Package";
import { BinaryTree } from "../models/BinaryTree";
import { Withdrawal } from "../models/Withdrawal";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Types } from "mongoose";
import { WalletType, WithdrawalStatus } from "../models/types";
import { updateWallet, calculateDailyBinaryBonuses } from "../services/investment.service";
import { createBinaryTransaction, createReferralTransaction } from "../services/transaction.service";
import { triggerDailyCalculations as triggerDailyCalculationsCron } from "../cron/roi-cron";
import { Voucher } from "../models/Voucher";
import { Ticket } from "../models/Ticket";
import { Settings } from "../models/Settings";
import { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } from "../lib/mail-service/email.service";
import bcrypt from "bcryptjs";

/**
 * Admin Signup
 * POST /api/v1/admin/signup
 */
export const adminSignup = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { name, email, phone, password, role } = body as { name: string; email: string; phone: string; password: string; role: string };

  // Validation
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    throw new AppError("Admin with this email already exists", 409);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError("Invalid email format", 400);
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400);
  }

  // Create admin
  const adminRole = role ? parseInt(role) : AdminRole.ADMIN;
  const admin = await Admin.create({
    name,
    email: email.toLowerCase(),
    phone: phone || undefined,
    password,
    role: adminRole,
    isVerified: false, // Can be set to true if email verification is not needed
  });

  // Generate JWT token
  const token = signAdminToken({
    sub: admin._id.toString(),
    role: admin.role,
    email: admin.email,
  });

  // Set token in cookie
  const response = res as any;
  response.cookie("adminToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  response.status(201).json({
    status: "success",
    message: "Admin created successfully",
    data: {
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isVerified: admin.isVerified,
      },
      token,
    },
  });
});

/**
 * Admin Login
 * POST /api/v1/admin/login
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { email, password } = body;

  // Validation
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  // Find admin by email
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    throw new AppError("Invalid email or password", 401);
  }

  // Check if admin is verified (optional check)
  if (!admin.isVerified) {
    throw new AppError("Admin account is not verified. Please contact super admin.", 403);
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  // Generate JWT token
  const token = signAdminToken({
    sub: admin._id.toString(),
    role: admin.role,
    email: admin.email,
  });

  // Set token in cookie
  const response = res as any;
  response.cookie("adminToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  response.status(200).json({
    status: "success",
    message: "Login successful",
    data: {
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isVerified: admin.isVerified,
      },
      token,
    },
  });
});

/**
 * Admin Logout
 * POST /api/v1/admin/logout
 */
export const adminLogout = asyncHandler(async (req, res) => {
  const response = res as any;
  response.clearCookie("adminToken");
  
  response.status(200).json({
    status: "success",
    message: "Logout successful",
  });
});

/**
 * Get Current Admin Profile
 * GET /api/v1/admin/me
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  // req.admin will be set by the adminAuth middleware
  const adminId = (req as any).admin?.id;
  
  if (!adminId) {
    throw new AppError("Admin not authenticated", 401);
  }

  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isVerified: admin.isVerified,
        createdAt: (admin as any).createdAt,
      },
    },
  });
});

/**
 * Manually trigger ROI calculation (for testing/admin use)
 * POST /api/v1/admin/trigger-roi
 */
export const triggerROI = asyncHandler(async (req, res) => {
  try {
    const result = await triggerROICalculation();
    
    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "ROI calculation triggered successfully",
      data: result,
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to trigger ROI calculation", 500);
  }
});

/**
 * Manually trigger all daily calculations: ROI and Binary bonuses
 * POST /api/v1/admin/trigger-daily-calculations
 * Body: { includeROI: true, includeBinary: true, includeReferral: true }
 * 
 * NOTE: Referral bonuses are NOT calculated in cron jobs.
 * They are paid immediately when investments are activated (one-time payment).
 */
export const triggerDailyCalculations = asyncHandler(async (req, res) => {
  try {
    const body = (req as any).body;
    const { includeROI = true, includeBinary = true, includeReferral = true } = body;

    const results: any = {
      roi: null,
      binary: null,
      referral: null,
    };

    // 1. Trigger ROI calculation
    if (includeROI) {
      try {
        await deactivateExpiredInvestments();
        const roiResult = await calculateDailyROI();
        results.roi = {
          success: true,
          processed: roiResult.processed,
          errors: roiResult.errors,
          total: roiResult.total,
        };
      } catch (error: any) {
        results.roi = {
          success: false,
          error: error.message || "ROI calculation failed",
        };
      }
    }

    // 2. Calculate daily binary bonuses (consumption model)
    if (includeBinary) {
      try {
        const binaryResult = await calculateDailyBinaryBonuses();
        results.binary = {
          success: true,
          processed: binaryResult.processed,
          errors: binaryResult.errors,
          totalBinaryPaid: binaryResult.totalBinaryPaid,
          total: binaryResult.total,
        };
      } catch (error: any) {
        results.binary = {
          success: false,
          error: error.message || "Binary calculation failed",
        };
      }
    }

    // NOTE: Referral bonuses are NOT calculated in cron jobs
    // Referral bonuses are paid IMMEDIATELY when investments are activated (one-time payment)
    // They should NOT be recalculated daily like ROI or binary bonuses
    if (includeReferral) {
      results.referral = {
        success: true,
        message: "Referral bonuses are paid immediately at investment activation, not in daily cron",
        processed: 0,
        errors: 0,
        total: 0,
      };
    }

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "Daily calculations triggered successfully",
      data: results,
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to trigger daily calculations", 500);
  }
});

/**
 * Get all users with their details
 * GET /api/v1/admin/users
 * Query params: page, limit, search
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build search query
    const searchQuery: any = {};
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Get users with pagination
    const users = await User.find(searchQuery)
      .select("_id userId name email phone status referrer position createdAt")
      .populate("referrer", "userId name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Get total count
    const total = await User.countDocuments(searchQuery);

    // Get investment totals for each user
    const userIds = users.map((u) => u._id);
    const investments = await Investment.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          totalInvestment: { $sum: { $toDouble: "$investedAmount" } },
        },
      },
    ]);

    const investmentMap = new Map();
    investments.forEach((inv) => {
      investmentMap.set(inv._id.toString(), inv.totalInvestment);
    });

    // Format users with additional data
    const formattedUsers = users.map((user) => {
      const totalInvestment = investmentMap.get(user._id.toString()) || 0;
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const treeLink = `${baseUrl}/tree?userId=${user.userId}`;

      return {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email || "-",
        phone: user.phone || "-",
        status: user.status,
        treeLink,
        totalInvestment: totalInvestment.toFixed(2),
        referrer: user.referrer
          ? {
              userId: (user.referrer as any).userId,
              name: (user.referrer as any).name,
            }
          : null,
        position: user.position || null,
        joinedAt: (user as any).createdAt || user.createdAt,
      };
    });

    const response = res as any;
    response.status(200).json({
      status: "success",
      data: {
        users: formattedUsers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to fetch users", 500);
  }
});

/**
 * Admin impersonate user (login as user)
 * POST /api/v1/admin/impersonate/:userId
 */
export const impersonateUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by userId
    const user = await User.findOne({ userId });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Check if user account is active
    if (user.status !== "active") {
      throw new AppError(`User account is ${user.status}`, 403);
    }

    // Generate user JWT token (not admin token)
    const token = signAuthToken({
      sub: user._id.toString(),
      role: "buyer",
    });

    // Set token in cookie
    const response = res as any;
    response.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    response.status(200).json({
      status: "success",
      message: "Impersonation successful",
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          referrer: user.referrer,
          position: user.position,
          status: user.status,
        },
        token,
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to impersonate user", 500);
  }
});

/**
 * Get admin dashboard statistics
 * GET /api/v1/admin/statistics
 */
export const getAdminStatistics = asyncHandler(async (req, res) => {
  try {
    // Total Users
    const totalUsers = await User.countDocuments({});

    // Verified Users (status === "active" and has email)
    const verifiedUsers = await User.countDocuments({
      status: "active",
      email: { $exists: true, $nin: [null, ""] },
    });

    // Unverified Users
    const unverifiedUsers = totalUsers - verifiedUsers;

    // Total Deposits (sum of all depositAmount from investments)
    const depositsResult = await Investment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$depositAmount" } },
        },
      },
    ]);
    const totalDeposits = depositsResult[0]?.total || 0;

    // Total Withdrawals (sum of all approved withdrawals)
    const withdrawalsResult = await Withdrawal.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    const totalWithdrawals = withdrawalsResult[0]?.total || 0;

    // Total Investment (sum of all investedAmount)
    const investmentResult = await Investment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$investedAmount" } },
        },
      },
    ]);
    const totalInvestment = investmentResult[0]?.total || 0;

    // Total Voucher Investment (investments with voucherId)
    const voucherInvestmentResult = await Investment.aggregate([
      {
        $match: { voucherId: { $exists: true, $nin: [null, ""] } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$investedAmount" } },
        },
      },
    ]);
    const totalVoucherInvestment = voucherInvestmentResult[0]?.total || 0;

    // Total Free Investment (type === "free")
    const freeInvestmentResult = await Investment.aggregate([
      {
        $match: { type: "free" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$investedAmount" } },
        },
      },
    ]);
    const totalFreeInvestment = freeInvestmentResult[0]?.total || 0;

    // Total Powerleg Investment (type === "powerleg")
    const powerlegInvestmentResult = await Investment.aggregate([
      {
        $match: { type: "powerleg" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$investedAmount" } },
        },
      },
    ]);
    const totalPowerlegInvestment = powerlegInvestmentResult[0]?.total || 0;

    // Total ROI (sum of all totalRoiEarned from investments)
    const roiResult = await Investment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$totalRoiEarned" } },
        },
      },
    ]);
    const totalROI = roiResult[0]?.total || 0;

    // Total Referral Bonus (sum of all referral wallet transactions)
    const referralResult = await WalletTransaction.aggregate([
      {
        $lookup: {
          from: "wallets",
          localField: "wallet",
          foreignField: "_id",
          as: "walletInfo",
        },
      },
      {
        $unwind: "$walletInfo",
      },
      {
        $match: {
          "walletInfo.type": WalletType.REFERRAL,
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    const totalReferralBonus = referralResult[0]?.total || 0;

    // Total Binary Bonus (sum of all binary wallet transactions)
    const binaryResult = await WalletTransaction.aggregate([
      {
        $lookup: {
          from: "wallets",
          localField: "wallet",
          foreignField: "_id",
          as: "walletInfo",
        },
      },
      {
        $unwind: "$walletInfo",
      },
      {
        $match: {
          "walletInfo.type": WalletType.BINARY,
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    const totalBinaryBonus = binaryResult[0]?.total || 0;

    const response = res as any;
    response.status(200).json({
      status: "success",
      data: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        totalDeposits: totalDeposits.toFixed(4),
        totalWithdrawals: totalWithdrawals.toFixed(4),
        totalInvestment: totalInvestment.toFixed(4),
        totalVoucherInvestment: totalVoucherInvestment.toFixed(4),
        totalFreeInvestment: totalFreeInvestment.toFixed(4),
        totalPowerlegInvestment: totalPowerlegInvestment.toFixed(4),
        totalROI: totalROI.toFixed(4),
        totalReferralBonus: totalReferralBonus.toFixed(4),
        totalBinaryBonus: totalBinaryBonus.toFixed(4),
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to fetch statistics", 500);
  }
});

/**
 * Get all withdrawals with pagination
 * GET /api/v1/admin/withdrawals
 */
export const getAllWithdrawals = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate("user", "userId name email phone walletAddress bankAccount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Withdrawal.countDocuments(query);

    const formattedWithdrawals = withdrawals.map((wd) => ({
      id: wd._id,
      userId: (wd.user as any)?.userId,
      userName: (wd.user as any)?.name,
      userEmail: (wd.user as any)?.email,
      userPhone: (wd.user as any)?.phone,
      walletAddress: (wd.user as any)?.walletAddress,
      bankAccount: (wd.user as any)?.bankAccount,
      amount: parseFloat(wd.amount.toString()),
      charges: parseFloat(wd.charges.toString()),
      finalAmount: parseFloat(wd.finalAmount.toString()),
      walletType: wd.walletType,
      status: wd.status,
      method: wd.method,
      cryptoType: wd.cryptoType,
      withdrawalId: wd.withdrawalId,
      createdAt: wd.createdAt,
    }));

    const response = res as any;
    response.status(200).json({
      status: "success",
      data: {
        withdrawals: formattedWithdrawals,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to fetch withdrawals", 500);
  }
});

/**
 * Approve withdrawal
 * POST /api/v1/admin/withdrawals/:id/approve
 */
export const approveWithdrawal = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await Withdrawal.findById(id).populate("user");
    if (!withdrawal) {
      throw new AppError("Withdrawal not found", 404);
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new AppError(`Withdrawal is already ${withdrawal.status}`, 400);
    }

    const user = withdrawal.user as any;
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Get the wallet based on walletType
    const wallet = await Wallet.findOne({
      user: user._id,
      type: withdrawal.walletType,
    });

    if (!wallet) {
      throw new AppError(`Wallet of type ${withdrawal.walletType} not found`, 404);
    }

    const currentBalance = parseFloat(wallet.balance.toString());
    const reservedAmount = parseFloat(wallet.reserved?.toString() || "0");
    const withdrawalAmount = parseFloat(withdrawal.amount.toString());

    // Check if there's enough balance (including reserved)
    if (currentBalance < withdrawalAmount) {
      throw new AppError("Insufficient balance in user's wallet", 400);
    }

    // Deduct from wallet balance
    const newBalance = currentBalance - withdrawalAmount;
    wallet.balance = Types.Decimal128.fromString(newBalance.toString());

    // Update reserved amount (subtract the withdrawal amount)
    const newReserved = Math.max(0, reservedAmount - withdrawalAmount);
    wallet.reserved = Types.Decimal128.fromString(newReserved.toString());
    await wallet.save();

    // Update withdrawal status
    withdrawal.status = WithdrawalStatus.APPROVED;
    withdrawal.withdrawalId = `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await withdrawal.save();

    // Create transaction record
    await WalletTransaction.create({
      user: user._id,
      wallet: wallet._id,
      type: "debit",
      amount: withdrawal.amount,
      currency: wallet.currency || "USD",
      balanceBefore: Types.Decimal128.fromString(currentBalance.toString()),
      balanceAfter: wallet.balance,
      status: "completed",
      txRef: withdrawal.withdrawalId,
      meta: {
        type: "withdrawal_approval",
        withdrawalId: withdrawal._id.toString(),
      },
    });

    // Send withdrawal approved email notification asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
        const dashboardLink = `${clientUrl}/withdraw`;
        
        await sendWithdrawalApprovedEmail({
          to: user.email,
          name: user.name,
          amount: parseFloat(withdrawal.amount.toString()),
          charges: parseFloat(withdrawal.charges.toString()),
          finalAmount: parseFloat(withdrawal.finalAmount.toString()),
          walletType: withdrawal.walletType,
          withdrawalId: withdrawal.withdrawalId || withdrawal._id.toString(),
          transactionId: withdrawal.withdrawalId || withdrawal._id.toString(),
          dashboardLink,
        });
      } catch (emailError: any) {
        console.error('Failed to send withdrawal approved email:', emailError.message);
        // Don't fail the withdrawal approval if email fails
      }
    });

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "Withdrawal approved successfully",
      data: {
        withdrawal: {
          id: withdrawal._id,
          status: withdrawal.status,
          withdrawalId: withdrawal.withdrawalId,
        },
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to approve withdrawal", 500);
  }
});

/**
 * Reject withdrawal
 * POST /api/v1/admin/withdrawals/:id/reject
 */
export const rejectWithdrawal = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = (req as any).body;

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      throw new AppError("Withdrawal not found", 404);
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new AppError(`Withdrawal is already ${withdrawal.status}`, 400);
    }

    // Release reserved amount back to wallet
    const user = await User.findById(withdrawal.user).select('email name');
    if (user) {
      const wallet = await Wallet.findOne({
        user: user._id,
        type: withdrawal.walletType,
      });

      if (wallet) {
        const reservedAmount = parseFloat(wallet.reserved?.toString() || "0");
        const withdrawalAmount = parseFloat(withdrawal.amount.toString());
        const newReserved = Math.max(0, reservedAmount - withdrawalAmount);
        wallet.reserved = Types.Decimal128.fromString(newReserved.toString());
        await wallet.save();
      }
    }

    // Update withdrawal status
    withdrawal.status = WithdrawalStatus.REJECTED;
    await withdrawal.save();

    // Send withdrawal rejected email notification asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
        const dashboardLink = `${clientUrl}/withdraw`;
        
        await sendWithdrawalRejectedEmail({
          to: user.email,
          name: user.name,
          amount: parseFloat(withdrawal.amount.toString()),
          charges: parseFloat(withdrawal.charges.toString()),
          finalAmount: parseFloat(withdrawal.finalAmount.toString()),
          walletType: withdrawal.walletType,
          withdrawalId: withdrawal._id.toString(),
          reason: reason || undefined,
          dashboardLink,
        });
      } catch (emailError: any) {
        console.error('Failed to send withdrawal rejected email:', emailError.message);
        // Don't fail the withdrawal rejection if email fails
      }
    });

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "Withdrawal rejected successfully",
      data: {
        withdrawal: {
          id: withdrawal._id,
          status: withdrawal.status,
        },
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to reject withdrawal", 500);
  }
});

/**
 * Delete user and all related data
 * DELETE /api/v1/admin/users/:userId
 */
export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by userId
    const user = await User.findOne({ userId });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Prevent deletion of admin user
    if (user.userId === "CROWN-000000") {
      throw new AppError("Cannot delete admin user", 403);
    }

    const userIdObj = user._id;

    // Start transaction-like deletion (MongoDB doesn't support transactions without replica set)
    // Delete in order to avoid reference issues

    // 1. Delete all Investments
    await Investment.deleteMany({ user: userIdObj });

    // 2. Delete all Wallets
    await Wallet.deleteMany({ user: userIdObj });

    // 3. Delete all WalletTransactions
    await WalletTransaction.deleteMany({ user: userIdObj });

    // 4. Delete all Withdrawals
    await Withdrawal.deleteMany({ user: userIdObj });

    // 5. Delete all Vouchers owned by user
    await Voucher.deleteMany({ user: userIdObj });
    // Also delete vouchers created by this user
    await Voucher.deleteMany({ createdBy: userIdObj });

    // 6. Delete all Tickets raised by user
    await Ticket.deleteMany({ raisedBy: userIdObj });

    // 7. Delete BinaryTree entry
    const binaryTree = await BinaryTree.findOne({ user: userIdObj });
    if (binaryTree) {
      // Update parent's BinaryTree to remove references
      if (binaryTree.parent) {
        const parentTree = await BinaryTree.findOne({ user: binaryTree.parent });
        if (parentTree) {
          if (parentTree.leftChild?.toString() === userIdObj.toString()) {
            parentTree.leftChild = null;
            await parentTree.save();
          }
          if (parentTree.rightChild?.toString() === userIdObj.toString()) {
            parentTree.rightChild = null;
            await parentTree.save();
          }
        }
      }

      // Update children's parent references (set to null or handle as needed)
      if (binaryTree.leftChild) {
        const leftChildTree = await BinaryTree.findOne({ user: binaryTree.leftChild });
        if (leftChildTree) {
          leftChildTree.parent = null;
          await leftChildTree.save();
        }
      }
      if (binaryTree.rightChild) {
        const rightChildTree = await BinaryTree.findOne({ user: binaryTree.rightChild });
        if (rightChildTree) {
          rightChildTree.parent = null;
          await rightChildTree.save();
        }
      }

      // Delete the BinaryTree entry
      await BinaryTree.deleteOne({ user: userIdObj });
    }

    // 8. Update other users' referrer field if they reference this user
    await User.updateMany(
      { referrer: userIdObj },
      { $set: { referrer: null } }
    );

    // 9. Finally, delete the User
    await User.deleteOne({ _id: userIdObj });

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "User and all related data deleted successfully",
      data: {
        deletedUserId: user.userId,
        deletedUserName: user.name,
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to delete user", 500);
  }
});

/**
 * Flush All Investments and Related Data
 * DELETE /api/v1/admin/investments/flush-all
 * This will delete all investments and reset related data (wallets, binary tree business volumes, transactions)
 * but will keep users intact
 */
export const flushAllInvestments = asyncHandler(async (req, res) => {
  try {
    // 1. Delete all Investments
    const investmentsResult = await Investment.deleteMany({});
    const investmentsDeleted = investmentsResult.deletedCount || 0;

    // 2. Delete all NOWPayments history (Payment records)
    const { Payment } = await import("../models/Payment");
    const paymentsResult = await Payment.deleteMany({});
    const paymentsDeleted = paymentsResult.deletedCount || 0;

    // 3. Delete all wallet transactions related to investments (ROI, Binary, Referral, Investment)
    // Get all ROI, Binary, Referral, and Investment wallets
    const roiWallets = await Wallet.find({ type: WalletType.ROI }).select("_id").lean();
    const binaryWallets = await Wallet.find({ type: WalletType.BINARY }).select("_id").lean();
    const referralWallets = await Wallet.find({ type: WalletType.REFERRAL }).select("_id").lean();
    const investmentWallets = await Wallet.find({ type: WalletType.INVESTMENT }).select("_id").lean();
    
    const walletIds = [
      ...roiWallets.map(w => w._id),
      ...binaryWallets.map(w => w._id),
      ...referralWallets.map(w => w._id),
      ...investmentWallets.map(w => w._id),
    ];

    // Delete all transactions from ROI, Binary, Referral, and Investment wallets
    const transactionsResult = await WalletTransaction.deleteMany({
      wallet: { $in: walletIds },
    });
    const transactionsDeleted = transactionsResult.deletedCount || 0;

    // 3. Reset all wallet balances (ROI, Binary, Referral, Investment wallets)
    // Keep Withdrawal wallets as they might have withdrawal records
    await Wallet.updateMany(
      { type: { $in: [WalletType.ROI, WalletType.BINARY, WalletType.REFERRAL, WalletType.INVESTMENT] } },
      {
        $set: {
          balance: Types.Decimal128.fromString("0"),
          renewablePrincipal: Types.Decimal128.fromString("0"),
          reserved: Types.Decimal128.fromString("0"),
        },
      }
    );

    // 4. Reset all BinaryTree business volumes and carry forwards
    await BinaryTree.updateMany(
      {},
      {
        $set: {
          leftBusiness: Types.Decimal128.fromString("0"),
          rightBusiness: Types.Decimal128.fromString("0"),
          leftCarry: Types.Decimal128.fromString("0"),
          rightCarry: Types.Decimal128.fromString("0"),
          leftMatched: Types.Decimal128.fromString("0"),
          rightMatched: Types.Decimal128.fromString("0"),
          matchingDue: Types.Decimal128.fromString("0"),
        },
      }
    );

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "All investments, transactions, and NOWPayments history flushed successfully",
      data: {
        investmentsDeleted,
        paymentsDeleted,
        transactionsDeleted,
        walletsReset: "ROI, Binary, Referral, Investment wallets reset to zero",
        binaryTreesReset: "All binary tree business volumes reset to zero",
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to flush investments", 500);
  }
});

/**
 * Get NOWPayments gateway status
 * GET /api/v1/admin/settings/nowpayments
 */
export const getNOWPaymentsStatus = asyncHandler(async (req, res) => {
  try {
    let setting = await Settings.findOne({ key: "nowpayments_enabled" });
    
    // If setting doesn't exist, create it with default value (true)
    if (!setting) {
      setting = await Settings.create({
        key: "nowpayments_enabled",
        value: true,
        description: "Enable or disable NOWPayments payment gateway",
      });
    }

    const response = res as any;
    response.status(200).json({
      status: "success",
      data: {
        enabled: setting.value === true || setting.value === "true",
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to get NOWPayments status", 500);
  }
});

/**
 * Update NOWPayments gateway status
 * PUT /api/v1/admin/settings/nowpayments
 * Body: { enabled: true/false }
 */
export const updateNOWPaymentsStatus = asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    throw new AppError("enabled must be a boolean value", 400);
  }

  try {
    const setting = await Settings.findOneAndUpdate(
      { key: "nowpayments_enabled" },
      { 
        value: enabled,
        description: "Enable or disable NOWPayments payment gateway",
      },
      { 
        upsert: true, 
        new: true 
      }
    );

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: `NOWPayments gateway ${enabled ? "enabled" : "disabled"} successfully`,
      data: {
        enabled: setting.value === true || setting.value === "true",
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to update NOWPayments status", 500);
  }
});

/**
 * Change user password by userId (Admin only)
 * PUT /api/v1/admin/users/:userId/password
 */
/**
 * Get admin reports (all user transactions)
 * GET /api/v1/admin/reports
 */
export const getAdminReports = asyncHandler(async (req, res) => {
  // Get all wallets
  const wallets = await Wallet.find({});
  const walletIds = wallets.map((w) => w._id);

  // Get all transactions with user info
  const transactions = await WalletTransaction.find({
    wallet: { $in: walletIds },
  })
    .populate("wallet", "type")
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  // Group transactions by type
  const roiTransactions = transactions.filter(
    (tx) => (tx.wallet as any)?.type === WalletType.ROI
  );
  const binaryTransactions = transactions.filter(
    (tx) => (tx.wallet as any)?.type === WalletType.BINARY
  );
  const referralTransactions = transactions.filter(
    (tx) => (tx.wallet as any)?.type === WalletType.REFERRAL
  );
  const investmentTransactions = transactions.filter(
    (tx) => (tx.wallet as any)?.type === WalletType.INVESTMENT
  );

  // Get all withdrawals with user info
  const withdrawals = await Withdrawal.find({})
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  // Get investments for investment transactions
  const investmentIds = investmentTransactions
    .map((tx) => tx.txRef)
    .filter((id): id is string => !!id);
  
  const investments = await Investment.find({
    _id: { $in: investmentIds.map((id) => new Types.ObjectId(id)) },
  })
    .populate("packageId", "packageName roi duration")
    .lean();

  const investmentMap = new Map();
  investments.forEach((inv) => {
    investmentMap.set(inv._id.toString(), inv);
  });

  const formatTransaction = (tx: any) => ({
    id: tx._id,
    userId: (tx.user as any)?.userId || "N/A",
    userName: (tx.user as any)?.name || "Unknown",
    userEmail: (tx.user as any)?.email || "N/A",
    type: tx.type,
    amount: parseFloat(tx.amount.toString()),
    currency: tx.currency || "USD",
    balanceBefore: parseFloat(tx.balanceBefore.toString()),
    balanceAfter: parseFloat(tx.balanceAfter.toString()),
    status: tx.status,
    txRef: tx.txRef,
    meta: tx.meta,
    createdAt: tx.createdAt,
  });

  const formatInvestmentTransaction = (tx: any) => {
    const investment = tx.txRef ? investmentMap.get(tx.txRef) : null;
    return {
      id: tx._id,
      userId: (tx.user as any)?.userId || "N/A",
      userName: (tx.user as any)?.name || "Unknown",
      userEmail: (tx.user as any)?.email || "N/A",
      type: tx.type,
      amount: parseFloat(tx.amount.toString()),
      currency: tx.currency || "USD",
      balanceBefore: parseFloat(tx.balanceBefore.toString()),
      balanceAfter: parseFloat(tx.balanceAfter.toString()),
      status: tx.status,
      txRef: tx.txRef,
      investment: investment ? {
        id: investment._id,
        packageName: (investment.packageId as any)?.packageName || "N/A",
        roi: (investment.packageId as any)?.roi || 0,
        duration: (investment.packageId as any)?.duration || 0,
        investedAmount: parseFloat(investment.investedAmount.toString()),
        type: investment.type,
        createdAt: investment.createdAt,
      } : null,
      meta: tx.meta,
      createdAt: tx.createdAt,
    };
  };

  const formatWithdrawal = (wd: any) => ({
    id: wd._id,
    userId: (wd.user as any)?.userId || "N/A",
    userName: (wd.user as any)?.name || "Unknown",
    userEmail: (wd.user as any)?.email || "N/A",
    amount: parseFloat(wd.amount.toString()),
    charges: parseFloat(wd.charges.toString()),
    finalAmount: parseFloat(wd.finalAmount.toString()),
    walletType: wd.walletType,
    status: wd.status,
    method: wd.method,
    withdrawalId: wd.withdrawalId,
    createdAt: wd.createdAt,
  });

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      roi: roiTransactions.map(formatTransaction),
      binary: binaryTransactions.map(formatTransaction),
      referral: referralTransactions.map(formatTransaction),
      investment: investmentTransactions.map(formatInvestmentTransaction),
      withdrawals: withdrawals.map(formatWithdrawal),
    },
  });
});

/**
 * Get Daily Business Report
 * GET /api/v1/admin/reports/daily-business
 */
export const getDailyBusinessReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date as string) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all investments created on this date
  const investments = await Investment.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("user", "userId name email")
    .populate("packageId", "packageName roi duration")
    .lean();

  // Get all transactions on this date
  const wallets = await Wallet.find({});
  const walletIds = wallets.map((w) => w._id);
  
  const transactions = await WalletTransaction.find({
    wallet: { $in: walletIds },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("wallet", "type")
    .populate("user", "userId name email")
    .lean();

  // Get withdrawals on this date
  const withdrawals = await Withdrawal.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("user", "userId name email")
    .lean();

  const totalInvestments = investments.reduce((sum, inv) => sum + parseFloat(inv.investedAmount.toString()), 0);
  const totalROI = transactions
    .filter((tx) => (tx.wallet as any)?.type === WalletType.ROI)
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalBinary = transactions
    .filter((tx) => (tx.wallet as any)?.type === WalletType.BINARY)
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalReferral = transactions
    .filter((tx) => (tx.wallet as any)?.type === WalletType.REFERRAL)
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalWithdrawals = withdrawals.reduce((sum, wd) => sum + parseFloat(wd.amount.toString()), 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalInvestments,
        totalROI,
        totalBinary,
        totalReferral,
        totalWithdrawals,
        netBusiness: totalInvestments - totalWithdrawals,
      },
      investments: investments.map((inv) => ({
        id: inv._id,
        userId: (inv.user as any)?.userId || "N/A",
        userName: (inv.user as any)?.name || "Unknown",
        userEmail: (inv.user as any)?.email || "N/A",
        packageName: (inv.packageId as any)?.packageName || "N/A",
        investedAmount: parseFloat(inv.investedAmount.toString()),
        type: inv.type,
        createdAt: inv.createdAt,
      })),
      transactions: transactions.length,
      withdrawals: withdrawals.length,
    },
  });
});

/**
 * Get NOWPayments Report
 * GET /api/v1/admin/reports/nowpayments
 */
export const getNOWPaymentsReport = asyncHandler(async (req, res) => {
  const { Payment } = await import("../models/Payment");
  
  const payments = await Payment.find({})
    .populate("user", "userId name email")
    .populate("package", "packageName")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const completedAmount = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const pendingAmount = payments
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalPayments: payments.length,
        totalAmount,
        completedAmount,
        pendingAmount,
        failedAmount: totalAmount - completedAmount - pendingAmount,
      },
      payments: payments.map((p) => ({
        id: p._id,
        userId: (p.user as any)?.userId || "N/A",
        userName: (p.user as any)?.name || "Unknown",
        userEmail: (p.user as any)?.email || "N/A",
        packageName: (p.package as any)?.packageName || "N/A",
        orderId: p.orderId,
        paymentId: p.paymentId,
        amount: parseFloat(p.amount.toString()),
        currency: p.currency,
        status: p.status,
        payAddress: p.payAddress,
        payAmount: p.payAmount ? parseFloat(p.payAmount.toString()) : null,
        payCurrency: p.payCurrency,
        actuallyPaid: p.actuallyPaid ? parseFloat(p.actuallyPaid.toString()) : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    },
  });
});

/**
 * Get Country Business Report
 * GET /api/v1/admin/reports/country-business
 */
export const getCountryBusinessReport = asyncHandler(async (req, res) => {
  const investments = await Investment.find({})
    .populate("user", "userId name email country")
    .populate("packageId", "packageName")
    .lean();

  // Group by country
  const countryBusiness = new Map<string, {
    country: string;
    totalInvestment: number;
    investmentCount: number;
    userCount: number;
    users: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      totalInvestment: number;
      investmentCount: number;
    }>;
  }>();

  investments.forEach((inv) => {
    const country = (inv.user as any)?.country || "Unknown";
    const userId = (inv.user as any)?._id?.toString() || "unknown";
    
    if (!countryBusiness.has(country)) {
      countryBusiness.set(country, {
        country,
        totalInvestment: 0,
        investmentCount: 0,
        userCount: 0,
        users: [],
      });
    }

    const countryData = countryBusiness.get(country)!;
    countryData.totalInvestment += parseFloat(inv.investedAmount.toString());
    countryData.investmentCount += 1;

    // Track user business
    let userData = countryData.users.find((u: any) => u.userId === (inv.user as any)?.userId);
    if (!userData) {
      userData = {
        userId: (inv.user as any)?.userId || "N/A",
        userName: (inv.user as any)?.name || "Unknown",
        userEmail: (inv.user as any)?.email || "N/A",
        totalInvestment: 0,
        investmentCount: 0,
      };
      countryData.users.push(userData);
      countryData.userCount = countryData.users.length;
    }
    userData.totalInvestment += parseFloat(inv.investedAmount.toString());
    userData.investmentCount += 1;
  });

  const countryStats = Array.from(countryBusiness.values())
    .sort((a, b) => b.totalInvestment - a.totalInvestment);

  const totalBusiness = countryStats.reduce((sum, c) => sum + c.totalInvestment, 0);
  const totalUsers = countryStats.reduce((sum, c) => sum + c.userCount, 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalCountries: countryStats.length,
        totalUsers,
        totalBusiness,
      },
      countries: countryStats,
    },
  });
});

/**
 * Get Investments Report
 * GET /api/v1/admin/reports/investments
 */
export const getInvestmentsReport = asyncHandler(async (req, res) => {
  const investments = await Investment.find({})
    .populate("user", "userId name email")
    .populate("packageId", "packageName roi duration")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = investments.reduce((sum, inv) => sum + parseFloat(inv.investedAmount.toString()), 0);
  const activeInvestments = investments.filter((inv) => inv.isActive).length;
  const totalROIEarned = investments.reduce((sum, inv) => sum + parseFloat((inv.totalRoiEarned?.toString() || "0")), 0);

  // Group by package
  const packageStats = new Map();
  investments.forEach((inv) => {
    const packageId = (inv.packageId as any)?._id?.toString() || "unknown";
    const packageName = (inv.packageId as any)?.packageName || "N/A";
    if (!packageStats.has(packageId)) {
      packageStats.set(packageId, {
        packageName,
        count: 0,
        totalAmount: 0,
      });
    }
    const pkg = packageStats.get(packageId);
    pkg.count += 1;
    pkg.totalAmount += parseFloat(inv.investedAmount.toString());
  });

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalInvestments: investments.length,
        activeInvestments,
        totalAmount,
        totalROIEarned,
      },
      packageStats: Array.from(packageStats.values()),
      investments: investments.map((inv) => ({
        id: inv._id,
        userId: (inv.user as any)?.userId || "N/A",
        userName: (inv.user as any)?.name || "Unknown",
        userEmail: (inv.user as any)?.email || "N/A",
        packageName: (inv.packageId as any)?.packageName || "N/A",
        investedAmount: parseFloat(inv.investedAmount.toString()),
        type: inv.type,
        isActive: inv.isActive,
        isBinaryUpdated: inv.isBinaryUpdated,
        totalRoiEarned: parseFloat((inv.totalRoiEarned?.toString() || "0")),
        startDate: inv.startDate,
        endDate: inv.endDate,
        createdAt: inv.createdAt,
      })),
    },
  });
});

/**
 * Get Withdrawals Report
 * GET /api/v1/admin/reports/withdrawals
 */
export const getWithdrawalsReport = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({})
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = withdrawals.reduce((sum, wd) => sum + parseFloat(wd.amount.toString()), 0);
  const approvedAmount = withdrawals
    .filter((wd) => wd.status === "approved")
    .reduce((sum, wd) => sum + parseFloat(wd.amount.toString()), 0);
  const pendingAmount = withdrawals
    .filter((wd) => wd.status === "pending")
    .reduce((sum, wd) => sum + parseFloat(wd.amount.toString()), 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalWithdrawals: withdrawals.length,
        totalAmount,
        approvedAmount,
        pendingAmount,
        rejectedAmount: totalAmount - approvedAmount - pendingAmount,
      },
      withdrawals: withdrawals.map((wd) => ({
        id: wd._id,
        userId: (wd.user as any)?.userId || "N/A",
        userName: (wd.user as any)?.name || "Unknown",
        userEmail: (wd.user as any)?.email || "N/A",
        amount: parseFloat(wd.amount.toString()),
        charges: parseFloat(wd.charges.toString()),
        finalAmount: parseFloat(wd.finalAmount.toString()),
        walletType: wd.walletType,
        status: wd.status,
        method: wd.method,
        withdrawalId: wd.withdrawalId,
        createdAt: wd.createdAt,
      })),
    },
  });
});

/**
 * Get Binary Report
 * GET /api/v1/admin/reports/binary
 */
export const getBinaryReport = asyncHandler(async (req, res) => {
  const wallets = await Wallet.find({ type: WalletType.BINARY });
  const walletIds = wallets.map((w) => w._id);

  const transactions = await WalletTransaction.find({
    wallet: { $in: walletIds },
  })
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalCredits = transactions
    .filter((tx) => tx.type === "credit")
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

  // Get binary tree stats
  const binaryTrees = await BinaryTree.find({})
    .populate("user", "userId name")
    .lean();

  const totalLeftBusiness = binaryTrees.reduce((sum, bt) => sum + parseFloat(bt.leftBusiness.toString()), 0);
  const totalRightBusiness = binaryTrees.reduce((sum, bt) => sum + parseFloat(bt.rightBusiness.toString()), 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalTransactions: transactions.length,
        totalAmount,
        totalCredits,
        totalLeftBusiness,
        totalRightBusiness,
        totalBusiness: totalLeftBusiness + totalRightBusiness,
      },
      transactions: transactions.map((tx) => ({
        id: tx._id,
        userId: (tx.user as any)?.userId || "N/A",
        userName: (tx.user as any)?.name || "Unknown",
        userEmail: (tx.user as any)?.email || "N/A",
        type: tx.type,
        amount: parseFloat(tx.amount.toString()),
        balanceBefore: parseFloat(tx.balanceBefore.toString()),
        balanceAfter: parseFloat(tx.balanceAfter.toString()),
        status: tx.status,
        createdAt: tx.createdAt,
      })),
    },
  });
});

/**
 * Get Referral Report
 * GET /api/v1/admin/reports/referral
 */
export const getReferralReport = asyncHandler(async (req, res) => {
  const wallets = await Wallet.find({ type: WalletType.REFERRAL });
  const walletIds = wallets.map((w) => w._id);

  const transactions = await WalletTransaction.find({
    wallet: { $in: walletIds },
  })
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalCredits = transactions
    .filter((tx) => tx.type === "credit")
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

  // Get referral stats by user
  const userReferrals = new Map();
  transactions.forEach((tx) => {
    const userId = (tx.user as any)?._id?.toString() || "unknown";
    if (!userReferrals.has(userId)) {
      userReferrals.set(userId, {
        userId: (tx.user as any)?.userId || "N/A",
        userName: (tx.user as any)?.name || "Unknown",
        userEmail: (tx.user as any)?.email || "N/A",
        totalReferralBonus: 0,
        referralCount: 0,
      });
    }
    const user = userReferrals.get(userId);
    if (tx.type === "credit") {
      user.totalReferralBonus += parseFloat(tx.amount.toString());
      user.referralCount += 1;
    }
  });

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalTransactions: transactions.length,
        totalAmount,
        totalCredits,
        totalUsers: userReferrals.size,
      },
      userStats: Array.from(userReferrals.values()),
      transactions: transactions.map((tx) => ({
        id: tx._id,
        userId: (tx.user as any)?.userId || "N/A",
        userName: (tx.user as any)?.name || "Unknown",
        userEmail: (tx.user as any)?.email || "N/A",
        type: tx.type,
        amount: parseFloat(tx.amount.toString()),
        balanceBefore: parseFloat(tx.balanceBefore.toString()),
        balanceAfter: parseFloat(tx.balanceAfter.toString()),
        status: tx.status,
        createdAt: tx.createdAt,
      })),
    },
  });
});

/**
 * Get ROI Report
 * GET /api/v1/admin/reports/roi
 */
export const getROIReport = asyncHandler(async (req, res) => {
  const wallets = await Wallet.find({ type: WalletType.ROI });
  const walletIds = wallets.map((w) => w._id);

  const transactions = await WalletTransaction.find({
    wallet: { $in: walletIds },
  })
    .populate("user", "userId name email")
    .sort({ createdAt: -1 })
    .lean();

  const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  const totalCredits = transactions
    .filter((tx) => tx.type === "credit")
    .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

  // Get ROI stats from investments
  const investments = await Investment.find({})
    .populate("user", "userId name email")
    .populate("packageId", "packageName roi")
    .lean();

  const totalROIEarned = investments.reduce((sum, inv) => sum + parseFloat((inv.totalRoiEarned?.toString() || "0")), 0);
  const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.investedAmount.toString()), 0);

  // Get ROI by user
  const userROI = new Map();
  transactions.forEach((tx) => {
    if (tx.type === "credit") {
      const userId = (tx.user as any)?._id?.toString() || "unknown";
      if (!userROI.has(userId)) {
        userROI.set(userId, {
          userId: (tx.user as any)?.userId || "N/A",
          userName: (tx.user as any)?.name || "Unknown",
          userEmail: (tx.user as any)?.email || "N/A",
          totalROI: 0,
          roiCount: 0,
        });
      }
      const user = userROI.get(userId);
      user.totalROI += parseFloat(tx.amount.toString());
      user.roiCount += 1;
    }
  });

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      summary: {
        totalTransactions: transactions.length,
        totalAmount,
        totalCredits,
        totalROIEarned,
        totalInvested,
        roiPercentage: totalInvested > 0 ? (totalROIEarned / totalInvested) * 100 : 0,
      },
      userStats: Array.from(userROI.values()),
      transactions: transactions.map((tx) => ({
        id: tx._id,
        userId: (tx.user as any)?.userId || "N/A",
        userName: (tx.user as any)?.name || "Unknown",
        userEmail: (tx.user as any)?.email || "N/A",
        type: tx.type,
        amount: parseFloat(tx.amount.toString()),
        balanceBefore: parseFloat(tx.balanceBefore.toString()),
        balanceAfter: parseFloat(tx.balanceAfter.toString()),
        status: tx.status,
        createdAt: tx.createdAt,
      })),
    },
  });
});

/**
 * Admin: Create investment for a user
 * POST /api/v1/admin/investments/create
 */
export const adminCreateInvestment = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { userId, packageId, amount, type = "admin" } = body as {
    userId: string;
    packageId: string;
    amount: number;
    type?: string;
  };

  if (!userId || !packageId || !amount) {
    throw new AppError("User ID, Package ID, and amount are required", 400);
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (!Types.ObjectId.isValid(packageId)) {
    throw new AppError("Invalid package ID", 400);
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Generate a unique payment ID for admin-created investments
  const paymentId = `ADMIN_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Use the existing processInvestment service
  const { processInvestment } = await import("../services/investment.service");
  const investment = await processInvestment(
    user._id as Types.ObjectId,
    new Types.ObjectId(packageId),
    amount,
    paymentId,
    undefined // No voucher for admin-created investments
  );

  // Update investment type to "admin" if specified
  if (type === "admin") {
    investment.type = "admin";
    await investment.save();
  }

  // Get package details for response
  const pkg = await Package.findById(packageId);
  
  // Send investment confirmation email
  try {
    if (user?.email && pkg) {
      const { sendInvestmentPurchaseEmail } = await import("../lib/mail-service/email.service");
      const startDateStr = investment.startDate instanceof Date 
        ? investment.startDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date(investment.startDate || Date.now()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

      const endDateStr = investment.endDate instanceof Date
        ? investment.endDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date(investment.endDate || Date.now() + (pkg.duration || 150) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardLink = `${clientUrl}/investments`;

      sendInvestmentPurchaseEmail({
        to: user.email,
        name: user.name || 'User',
        packageName: pkg.packageName || 'Investment Package',
        investmentAmount: Number(amount),
        duration: investment.durationDays || pkg.duration || 150,
        totalOutputPct: investment.totalOutputPct || pkg.totalOutputPct || 225,
        startDate: startDateStr,
        endDate: endDateStr,
        dashboardLink,
      }).catch((error) => {
        console.error('Failed to send investment purchase confirmation email:', error);
      });
    }
  } catch (error) {
    console.error('Error preparing investment purchase confirmation email:', error);
  }

  const response = res as any;
  response.status(201).json({
    status: "success",
    message: "Investment created successfully for user",
    data: {
      investment: {
        id: investment._id,
        userId: user.userId,
        userName: user.name,
        packageId: investment.packageId,
        packageName: pkg?.packageName,
        investedAmount: parseFloat(investment.investedAmount.toString()),
        type: investment.type,
        createdAt: investment.createdAt,
      },
    },
  });
});

/**
 * Get all tickets
 * GET /api/v1/admin/tickets
 */
export const getAllTickets = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const { Ticket } = await import("../models/Ticket");
  
  const query: any = {};
  if (status) {
    query.status = status;
  }

  const tickets = await Ticket.find(query)
    .populate("raisedBy", "userId name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Ticket.countDocuments(query);

  const formattedTickets = tickets.map((ticket: any) => ({
    id: ticket._id,
    raisedBy: {
      userId: (ticket.raisedBy as any)?.userId || "N/A",
      name: (ticket.raisedBy as any)?.name || "Unknown",
      email: (ticket.raisedBy as any)?.email || "N/A",
    },
    department: ticket.department,
    service: ticket.service,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    document: ticket.document,
    reply: ticket.reply,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      tickets: formattedTickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

/**
 * Update ticket status
 * PUT /api/v1/admin/tickets/:ticketId
 */
export const updateTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const body = (req as any).body;
  const { status, reply } = body as {
    status?: "Open" | "Closed" | "In Progress";
    reply?: string;
  };

  if (!Types.ObjectId.isValid(ticketId)) {
    throw new AppError("Invalid ticket ID", 400);
  }

  const { Ticket } = await import("../models/Ticket");
  const ticket = await Ticket.findById(ticketId).populate("raisedBy", "userId name email");
  
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  const oldStatus = ticket.status;

  if (status) {
    if (!["Open", "Closed", "In Progress"].includes(status)) {
      throw new AppError("Invalid status. Must be Open, Closed, or In Progress", 400);
    }
    ticket.status = status as "Open" | "Closed" | "In Progress";
  }

  if (reply !== undefined) {
    ticket.reply = reply;
  }

  await ticket.save();

  // Send email notification on any ticket update (status change or reply added)
  const hasStatusChanged = status && status !== oldStatus;
  const hasReplyAdded = reply !== undefined && reply !== null && reply.trim() !== '';
  const userEmail = (ticket.raisedBy as any)?.email;
  
  if ((hasStatusChanged || hasReplyAdded) && userEmail) {
    try {
      const { sendTicketStatusUpdateEmail } = await import("../lib/mail-service/email.service");
      
      // Determine the status to use (new status if changed, otherwise current status)
      const currentStatus = status || ticket.status;
      
      sendTicketStatusUpdateEmail({
        to: userEmail,
        name: (ticket.raisedBy as any).name || "User",
        ticketId: ticketId,
        subject: ticket.subject,
        oldStatus: hasStatusChanged ? oldStatus : ticket.status,
        newStatus: currentStatus,
        reply: reply || ticket.reply || "",
      }).catch((error) => {
        console.error('Failed to send ticket status update email:', error);
      });
    } catch (error) {
      console.error('Error preparing ticket status update email:', error);
    }
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Ticket updated successfully",
    data: {
      ticket: {
        id: ticket._id,
        raisedBy: {
          userId: (ticket.raisedBy as any)?.userId || "N/A",
          name: (ticket.raisedBy as any)?.name || "Unknown",
          email: (ticket.raisedBy as any)?.email || "N/A",
        },
        department: ticket.department,
        service: ticket.service,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        document: ticket.document,
        reply: ticket.reply,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    },
  });
});

export const changeUserPassword = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const body = (req as any).body;
  const { newPassword } = body;

  // Validation
  if (!newPassword) {
    throw new AppError("New password is required", 400);
  }

  if (newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400);
  }

  // Find user by userId
  const user = await User.findOne({ userId });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Update password (will be hashed by pre-save hook)
  user.password = newPassword;
  await user.save();

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "User password updated successfully",
    data: {
      userId: user.userId,
      name: user.name,
      email: user.email,
    },
  });
});

