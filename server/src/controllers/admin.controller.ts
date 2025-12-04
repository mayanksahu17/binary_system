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

    // 2. Delete all wallet transactions related to investments (ROI, Binary, Referral)
    const transactionsResult = await WalletTransaction.deleteMany({
      $or: [
        { "meta.type": "roi" },
        { "meta.type": "binary" },
        { "meta.type": "referral" },
        { "meta.type": "investment" },
        { "meta.type": "activation" },
      ],
    });
    const transactionsDeleted = transactionsResult.deletedCount || 0;

    // 3. Reset all wallet balances (ROI, Binary, Referral wallets)
    // Keep Investment and Withdrawal wallets as they might have deposits/withdrawals
    await Wallet.updateMany(
      { type: { $in: [WalletType.ROI, WalletType.BINARY, WalletType.REFERRAL] } },
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
      message: "All investments and related data flushed successfully",
      data: {
        investmentsDeleted,
        transactionsDeleted,
        walletsReset: "ROI, Binary, Referral wallets reset to zero",
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

