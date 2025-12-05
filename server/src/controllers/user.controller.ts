import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { Wallet } from "../models/Wallet";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { Payment } from "../models/Payment";
import { BinaryTree } from "../models/BinaryTree";
import { WalletTransaction } from "../models/WalletTransaction";
import { Withdrawal } from "../models/Withdrawal";
import { Voucher } from "../models/Voucher";
import { User } from "../models/User";
import { WalletType, WithdrawalStatus } from "../models/types";
import { processInvestment } from "../services/investment.service";
import { processMockPayment } from "../lib/payments/mock-nowpayments";
import { exchangeWallets } from "../services/wallet-exchange.service";
import { sendInvestmentPurchaseEmail, sendWithdrawalCreatedEmail } from "../lib/mail-service/email.service";
import { getUserCareerProgress } from "../services/career-level.service";
import { Types } from "mongoose";

/**
 * Get user wallets
 * GET /api/v1/user/wallets
 */
export const getUserWallets = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const wallets = await Wallet.find({ user: userId })
    .select("type balance reserved currency")
    .lean();

  const walletsFormatted = wallets.map((wallet) => ({
    type: wallet.type,
    balance: parseFloat(wallet.balance.toString()),
    reserved: parseFloat(wallet.reserved?.toString() || "0"),
    currency: wallet.currency || "USD",
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      wallets: walletsFormatted,
    },
  });
});

/**
 * Get available packages for users
 * GET /api/v1/user/packages
 */
export const getUserPackages = asyncHandler(async (req, res) => {
  const packages = await Package.find({ status: "Active" })
    .select("_id packageName minAmount maxAmount duration totalOutputPct renewablePrinciplePct referralPct binaryPct powerCapacity status roi binaryBonus cappingLimit principleReturn levelOneReferral")
    .lean();

  const packagesFormatted = packages.map((pkg) => ({
    id: pkg._id,
    packageName: pkg.packageName,
    minAmount: parseFloat(pkg.minAmount.toString()),
    maxAmount: parseFloat(pkg.maxAmount.toString()),
    duration: pkg.duration,
    // New fields
    totalOutputPct: pkg.totalOutputPct,
    renewablePrinciplePct: pkg.renewablePrinciplePct,
    referralPct: pkg.referralPct,
    binaryPct: pkg.binaryPct,
    powerCapacity: parseFloat(pkg.powerCapacity?.toString() || "0"),
    status: pkg.status,
    // Legacy fields (for backward compatibility)
    roi: pkg.roi,
    binaryBonus: pkg.binaryBonus,
    cappingLimit: parseFloat(pkg.cappingLimit?.toString() || "0"),
    principleReturn: pkg.principleReturn,
    levelOneReferral: pkg.levelOneReferral,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      packages: packagesFormatted,
    },
  });
});

/**
 * Create investment
 * POST /api/v1/user/invest
 */
export const createInvestment = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const body = req.body;
  const { packageId, amount, currency = "USD", paymentId, voucherId } = body;

  if (!packageId || !amount) {
    throw new AppError("Package ID and amount are required", 400);
  }

  if (!Types.ObjectId.isValid(packageId)) {
    throw new AppError("Invalid package ID", 400);
  }

  let finalPaymentId: string;
  let paymentResult: any = null;
  let finalVoucherId = voucherId;

  // If paymentId is provided (from NOWPayments), use it. Otherwise, process mock payment.
  if (paymentId) {
    // Check if investment already exists for this paymentId (prevent duplicates)
    const existingInvestment = await Investment.findOne({ voucherId: paymentId });
    if (existingInvestment) {
      throw new AppError("Investment already exists for this payment. Duplicate investment prevented.", 400);
    }

    // Check if payment record exists and already has an investment
    const payment = await Payment.findOne({ paymentId: paymentId });
    if (payment && payment.investmentId) {
      throw new AppError("Investment already exists for this payment. Duplicate investment prevented.", 400);
    }

    // Payment already processed via NOWPayments, use the provided paymentId
    finalPaymentId = paymentId;
    
    // If voucherId is not provided but payment has voucher in meta, extract it
    if (!finalVoucherId) {
      const { Payment } = await import("../models/Payment");
      const payment = await Payment.findOne({ paymentId, user: userId });
      if (payment && payment.meta && (payment.meta as any).voucherId) {
        // Extract voucherId from payment meta if not provided
        finalVoucherId = (payment.meta as any).voucherId;
      }
    }
    
    // Create payment result structure for response
    paymentResult = {
      paymentId: paymentId,
      status: "completed",
    };
  } else {
    // Process mock payment (legacy flow)
    paymentResult = await processMockPayment({
      amount: Number(amount),
      currency,
      packageId,
      userId,
    });

    if (!paymentResult.success) {
      throw new AppError(paymentResult.message || "Payment failed", 400);
    }

    finalPaymentId = paymentResult.paymentId;
  }

  // Process investment
  const investment = await processInvestment(
    new Types.ObjectId(userId),
    new Types.ObjectId(packageId),
    Number(amount),
    finalPaymentId,
    finalVoucherId // Pass voucherId if provided or extracted from payment
  );

  // Update payment record with investmentId to prevent duplicates
  if (paymentId) {
    await Payment.updateOne(
      { paymentId: paymentId },
      { $set: { investmentId: investment._id } }
    );
  }

  // Get updated wallets
  const wallets = await Wallet.find({ user: userId })
    .select("type balance reserved currency")
    .lean();

  const walletsFormatted = wallets.map((wallet) => ({
    type: wallet.type,
    balance: parseFloat(wallet.balance.toString()),
    reserved: parseFloat(wallet.reserved?.toString() || "0"),
    currency: wallet.currency || "USD",
  }));

  // Get updated binary tree info
  const binaryTree = await BinaryTree.findOne({ user: userId })
    .select("leftBusiness rightBusiness leftCarry rightCarry")
    .lean();

  // Send investment purchase confirmation email if user has email
  try {
    const user = await User.findById(userId).select('email name').lean();
    const pkg = await Package.findById(packageId).select('packageName duration totalOutputPct').lean();
    
    if (user?.email && pkg) {
      // Format dates - investment.startDate and investment.endDate are Date objects
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

      // Generate dashboard link
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardLink = `${clientUrl}/investments`;

      // Send email asynchronously (don't wait for it)
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
        // Log error but don't fail investment if email fails
        console.error('Failed to send investment purchase confirmation email:', error);
      });
    }
  } catch (error) {
    // Log error but don't fail investment if email fails
    console.error('Error preparing investment purchase confirmation email:', error);
  }

  const response = res as any;
  response.status(201).json({
    status: "success",
    message: "Investment created successfully",
    data: {
      investment: {
        id: investment._id,
        packageId: investment.packageId,
        investedAmount: parseFloat(investment.investedAmount.toString()),
        depositAmount: parseFloat(investment.depositAmount.toString()),
        type: investment.type,
        createdAt: investment.createdAt,
      },
      payment: {
        paymentId: paymentResult.paymentId,
        status: paymentResult.status,
      },
      wallets: walletsFormatted,
      binaryTree: binaryTree ? {
        leftBusiness: parseFloat(binaryTree.leftBusiness.toString()),
        rightBusiness: parseFloat(binaryTree.rightBusiness.toString()),
        leftCarry: parseFloat(binaryTree.leftCarry.toString()),
        rightCarry: parseFloat(binaryTree.rightCarry.toString()),
      } : null,
    },
  });
});

/**
 * Get user investments
 * GET /api/v1/user/investments
 */
export const getUserInvestments = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const investments = await Investment.find({ user: userId })
    .populate("packageId", "packageName roi duration")
    .sort({ createdAt: -1 })
    .lean();

  const investmentsFormatted = investments.map((inv) => ({
    id: inv._id,
    package: inv.packageId ? {
      id: (inv.packageId as any)._id,
      name: (inv.packageId as any).packageName,
      roi: (inv.packageId as any).roi,
      duration: (inv.packageId as any).duration,
    } : null,
    investedAmount: parseFloat(inv.investedAmount.toString()),
    depositAmount: parseFloat(inv.depositAmount.toString()),
    type: inv.type,
    isBinaryUpdated: inv.isBinaryUpdated,
    createdAt: inv.createdAt,
    expiresOn: inv.expiresOn,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      investments: investmentsFormatted,
    },
  });
});

/**
 * Get user binary tree info
 * GET /api/v1/user/binary-tree
 */
export const getUserBinaryTree = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const binaryTree = await BinaryTree.findOne({ user: userId })
    .populate("parent", "userId name")
    .populate("leftChild", "userId name")
    .populate("rightChild", "userId name")
    .lean();

  if (!binaryTree) {
    throw new AppError("Binary tree not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      binaryTree: {
        parent: binaryTree.parent ? {
          id: (binaryTree.parent as any)._id,
          userId: (binaryTree.parent as any).userId,
          name: (binaryTree.parent as any).name,
        } : null,
        leftChild: binaryTree.leftChild ? {
          id: (binaryTree.leftChild as any)._id,
          userId: (binaryTree.leftChild as any).userId,
          name: (binaryTree.leftChild as any).name,
        } : null,
        rightChild: binaryTree.rightChild ? {
          id: (binaryTree.rightChild as any)._id,
          userId: (binaryTree.rightChild as any).userId,
          name: (binaryTree.rightChild as any).name,
        } : null,
        leftBusiness: parseFloat(binaryTree.leftBusiness.toString()),
        rightBusiness: parseFloat(binaryTree.rightBusiness.toString()),
        leftCarry: parseFloat(binaryTree.leftCarry.toString()),
        rightCarry: parseFloat(binaryTree.rightCarry.toString()),
        leftDownlines: binaryTree.leftDownlines,
        rightDownlines: binaryTree.rightDownlines,
        cappingLimit: binaryTree.cappingLimit ? parseFloat(binaryTree.cappingLimit.toString()) : 0,
      },
    },
  });
});

/**
 * Get user wallet transactions
 * GET /api/v1/user/transactions
 */
export const getUserTransactions = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { walletType, type, page = 1, limit = 50 } = req.query;

  const query: any = { user: userId };
  if (walletType) {
    const wallet = await Wallet.findOne({ user: userId, type: walletType });
    if (wallet) {
      query.wallet = wallet._id;
    } else {
      // If wallet doesn't exist, return empty results
      const response = res as any;
      return response.status(200).json({
        status: "success",
        data: {
          transactions: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            pages: 0,
          },
        },
      });
    }
  }
  if (type) {
    query.type = type;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const transactions = await WalletTransaction.find(query)
    .populate("wallet", "type")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await WalletTransaction.countDocuments(query);

  const transactionsFormatted = transactions.map((tx) => ({
    id: tx._id,
    walletType: (tx.wallet as any)?.type || "unknown",
    type: tx.type,
    amount: parseFloat(tx.amount.toString()),
    currency: tx.currency || "USD",
    balanceBefore: parseFloat(tx.balanceBefore.toString()),
    balanceAfter: parseFloat(tx.balanceAfter.toString()),
    status: tx.status,
    txRef: tx.txRef,
    meta: tx.meta,
    createdAt: tx.createdAt,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      transactions: transactionsFormatted,
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
 * Get user reports (transactions grouped by type)
 * GET /api/v1/user/reports
 */
export const getUserReports = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  // Get all wallets for the user
  const wallets = await Wallet.find({ user: userId });
  const walletIds = wallets.map((w) => w._id);

  // Get transactions grouped by wallet type
  const transactions = await WalletTransaction.find({
    user: userId,
    wallet: { $in: walletIds },
  })
    .populate("wallet", "type")
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

  // Get withdrawals
  const withdrawals = await Withdrawal.find({ user: userId })
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
 * Create withdrawal request
 * POST /api/v1/user/withdraw
 */
export const createWithdrawal = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { amount, walletType, method = "regular" } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError("Invalid withdrawal amount", 400);
  }

  if (!walletType || !["roi", "interest", "r&b", "withdrawal"].includes(walletType)) {
    throw new AppError("Invalid wallet type", 400);
  }

  // Check if user has wallet address or bank account
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const hasWalletAddress = user.walletAddress && user.walletAddress.trim().length > 0;
  const hasBankAccount = user.bankAccount?.accountNumber && user.bankAccount.accountNumber.trim().length > 0;

  if (!hasWalletAddress && !hasBankAccount) {
    throw new AppError(
      "Wallet address or bank account is required. Please set your wallet address or bank account details before requesting a withdrawal.",
      400
    );
  }

  // Get user's binary tree to check capping limit
  const binaryTree = await BinaryTree.findOne({ user: userId });
  if (!binaryTree) {
    throw new AppError("Binary tree not found", 404);
  }

  const cappingLimit = parseFloat(binaryTree.cappingLimit?.toString() || "0");
  if (cappingLimit > 0 && amount > cappingLimit) {
    throw new AppError(
      `Withdrawal amount exceeds capping limit of $${cappingLimit.toFixed(2)}`,
      400
    );
  }

  // Get the wallet
  const wallet = await Wallet.findOne({ user: userId, type: walletType });
  if (!wallet) {
    throw new AppError(`Wallet of type ${walletType} not found`, 404);
  }

  const currentBalance = parseFloat(wallet.balance.toString());
  if (amount > currentBalance) {
    throw new AppError("Insufficient balance", 400);
  }

  // Calculate charges (5% default)
  const charges = amount * 0.05;
  const finalAmount = amount - charges;

  // Create withdrawal record
  const withdrawal = await Withdrawal.create({
    user: userId,
    amount: Types.Decimal128.fromString(amount.toString()),
    charges: Types.Decimal128.fromString(charges.toString()),
    finalAmount: Types.Decimal128.fromString(finalAmount.toString()),
    walletType,
    status: WithdrawalStatus.PENDING,
    method,
  });

  // Reserve the amount in wallet
  const reservedAmount = parseFloat(wallet.reserved?.toString() || "0");
  wallet.reserved = Types.Decimal128.fromString(
    (reservedAmount + amount).toString()
  );
  await wallet.save();

  // Create transaction record
  await WalletTransaction.create({
    user: userId,
    wallet: wallet._id,
    type: "debit",
    amount: Types.Decimal128.fromString(amount.toString()),
    currency: wallet.currency || "USD",
    balanceBefore: wallet.balance,
    balanceAfter: Types.Decimal128.fromString(
      (currentBalance - amount).toString()
    ),
    status: "pending",
    txRef: withdrawal._id.toString(),
    meta: { type: "withdrawal", withdrawalId: withdrawal._id.toString() },
  });

  // Send withdrawal created email notification asynchronously (non-blocking)
  setImmediate(async () => {
    try {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardLink = `${clientUrl}/withdraw`;
      
      await sendWithdrawalCreatedEmail({
        to: user.email,
        name: user.name,
        amount: parseFloat(withdrawal.amount.toString()),
        charges: parseFloat(withdrawal.charges.toString()),
        finalAmount: parseFloat(withdrawal.finalAmount.toString()),
        walletType: withdrawal.walletType,
        withdrawalId: withdrawal._id.toString(),
        dashboardLink,
      });
    } catch (emailError: any) {
      console.error('Failed to send withdrawal created email:', emailError.message);
      // Don't fail the withdrawal creation if email fails
    }
  });

  const response = res as any;
  response.status(201).json({
    status: "success",
    data: {
      withdrawal: {
        id: withdrawal._id,
        amount: parseFloat(withdrawal.amount.toString()),
        charges: parseFloat(withdrawal.charges.toString()),
        finalAmount: parseFloat(withdrawal.finalAmount.toString()),
        walletType: withdrawal.walletType,
        status: withdrawal.status,
        method: withdrawal.method,
        createdAt: withdrawal.createdAt,
      },
    },
  });
});

/**
 * Get user vouchers
 * GET /api/v1/user/vouchers?status=active
 */
export const getUserVouchers = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  // Get status filter from query params
  const { status } = req.query;
  
  // Build query filter
  const filter: any = { user: userId };
  if (status) {
    filter.status = status;
  }

  const vouchers = await Voucher.find(filter)
    .populate("fromWallet", "type")
    .populate("createdBy", "name userId")
    .sort({ createdAt: -1 })
    .lean();

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      vouchers: vouchers.map((v) => ({
        id: v._id,
        voucherId: v.voucherId,
        amount: parseFloat(v.amount.toString()),
        investmentValue: v.investmentValue ? parseFloat(v.investmentValue.toString()) : parseFloat(v.amount.toString()) * 2, // Default 2x if not set
        multiplier: v.multiplier || 2,
        originalAmount: v.originalAmount
          ? parseFloat(v.originalAmount.toString())
          : null,
        fromWalletType: (v.fromWallet as any)?.type || null,
        createdBy: v.createdBy
          ? {
              name: (v.createdBy as any).name,
              userId: (v.createdBy as any).userId,
            }
          : null,
        status: v.status,
        createdOn: v.createdOn,
        usedAt: v.usedAt,
        expiry: v.expiry,
        createdAt: (v as any).createdAt,
      })),
    },
  });
});

/**
 * Create voucher (from wallet or via payment gateway)
 * POST /api/v1/user/vouchers/create
 * 
 * If fromWalletType is provided, voucher is created from wallet balance
 * If fromWalletType is not provided, payment gateway is used
 */
export const createVoucher = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { amount, fromWalletType, currency = "USD" } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError("Invalid voucher amount", 400);
  }

  const voucherMultiplier = 2; // 2x multiplier: $100 voucher = $200 investment value
  const investmentValue = amount * voucherMultiplier;
  const expiryDays = 120; // 120 days expiration

  // Generate unique voucher ID
  const voucherId = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // If fromWalletType is provided, create voucher from wallet
  if (fromWalletType) {
    const fromWallet = await Wallet.findOne({ user: userId, type: fromWalletType });
    if (!fromWallet) {
      throw new AppError(`Wallet of type ${fromWalletType} not found`, 404);
    }

    const currentBalance = parseFloat(fromWallet.balance.toString());
    if (amount > currentBalance) {
      throw new AppError("Insufficient balance", 400);
    }

    // Create voucher
    const voucher = await Voucher.create({
      voucherId,
      user: userId,
      fromWallet: fromWallet._id,
      amount: Types.Decimal128.fromString(amount.toString()),
      investmentValue: Types.Decimal128.fromString(investmentValue.toString()),
      multiplier: voucherMultiplier,
      originalAmount: Types.Decimal128.fromString(amount.toString()),
      createdBy: userId,
      status: "active",
      expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
    });

    // Deduct amount from wallet
    const newBalance = parseFloat(fromWallet.balance.toString()) - amount;
    fromWallet.balance = Types.Decimal128.fromString(newBalance.toString());
    await fromWallet.save();

    // Create transaction
    await WalletTransaction.create({
      user: userId,
      wallet: fromWallet._id,
      type: "debit",
      amount: Types.Decimal128.fromString(amount.toString()),
      currency: fromWallet.currency || "USD",
      balanceBefore: Types.Decimal128.fromString(
        (parseFloat(fromWallet.balance.toString()) + amount).toString()
      ),
      balanceAfter: fromWallet.balance,
      status: "completed",
      txRef: voucherId,
      meta: { type: "voucher_creation", voucherId },
    });

    const response = res as any;
    return response.status(201).json({
      status: "success",
      message: "Voucher created successfully",
      data: {
        voucher: {
          id: voucher._id,
          voucherId: voucher.voucherId,
          amount: parseFloat(voucher.amount.toString()),
          investmentValue: parseFloat(voucher.investmentValue.toString()),
          multiplier: voucher.multiplier,
          status: voucher.status,
          expiry: voucher.expiry,
          createdAt: (voucher as any).createdAt,
        },
      },
    });
  }

  // If no fromWalletType, check if payment gateway is enabled
  // If gateway is disabled, create voucher directly without payment
  const { Settings } = await import("../models/Settings");
  const nowpaymentsSetting = await Settings.findOne({ key: "nowpayments_enabled" });
  const isNOWPaymentsEnabled = nowpaymentsSetting === null || nowpaymentsSetting.value === true || nowpaymentsSetting.value === "true";

  // If payment gateway is disabled, create voucher directly without payment
  if (!isNOWPaymentsEnabled) {
    // Create voucher immediately without payment processing
    const voucher = await Voucher.create({
      voucherId,
      user: userId,
      amount: Types.Decimal128.fromString(amount.toString()),
      investmentValue: Types.Decimal128.fromString(investmentValue.toString()),
      multiplier: voucherMultiplier,
      originalAmount: Types.Decimal128.fromString(amount.toString()),
      createdBy: userId,
      status: "active",
      expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
    });

    const response = res as any;
    return response.status(201).json({
      status: "success",
      message: "Voucher created successfully (payment gateway disabled)",
      data: {
        voucher: {
          id: voucher._id,
          voucherId: voucher.voucherId,
          amount: parseFloat(voucher.amount.toString()),
          investmentValue: parseFloat(voucher.investmentValue.toString()),
          multiplier: voucher.multiplier,
          status: voucher.status,
          expiry: voucher.expiry,
          createdAt: (voucher as any).createdAt,
        },
      },
    });
  }

  // If payment gateway is enabled, proceed with payment processing
  const { createNOWPaymentsInvoice } = await import("../lib/payments/nowpayments");

  // Generate order ID for voucher purchase
  const orderId = `VCH_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Get callback URLs
  const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const callbackUrl = process.env.NOWPAYMENTS_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/v1/payment/callback`;
  const successUrl = `${baseUrl}/vouchers/success?orderId=${orderId}`;
  const cancelUrl = `${baseUrl}/vouchers/cancel?orderId=${orderId}`;

  // Get user email
  const user = await User.findById(userId).select("email").lean();
  const customerEmail = user?.email || undefined;

  // Create invoice with NOWPayments
  try {
    const invoiceResponse = await createNOWPaymentsInvoice({
      price_amount: amount,
      price_currency: currency.toUpperCase(),
      order_id: orderId,
      order_description: `Voucher Purchase - $${amount} (Investment Value: $${investmentValue})`,
      ipn_callback_url: callbackUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
    });

    // Construct invoice URL
    let invoiceUrl = invoiceResponse.invoice_url;
    if (!invoiceUrl && invoiceResponse.id) {
      invoiceUrl = `https://nowpayments.io/invoice/?iid=${invoiceResponse.id}`;
    } else if (!invoiceUrl && invoiceResponse.token) {
      invoiceUrl = `https://nowpayments.io/invoice/?token=${invoiceResponse.token}`;
    }

    if (!invoiceUrl) {
      throw new AppError("Invoice URL not provided by NOWPayments", 500);
    }

    // Create voucher with pending status (will be activated after payment)
    const voucher = await Voucher.create({
      voucherId,
      user: userId,
      amount: Types.Decimal128.fromString(amount.toString()),
      investmentValue: Types.Decimal128.fromString(investmentValue.toString()),
      multiplier: voucherMultiplier,
      originalAmount: Types.Decimal128.fromString(amount.toString()),
      createdBy: userId,
      status: "active", // Will be activated after payment confirmation
      expiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      paymentId: invoiceResponse.id || invoiceResponse.token || orderId,
      orderId,
    });

    // Store payment record (using Payment model if it exists, or create a simple record)
    const { Payment } = await import("../models/Payment");
    await Payment.create({
      user: new Types.ObjectId(userId),
      orderId,
      paymentId: invoiceResponse.id || invoiceResponse.token || orderId,
      amount: Types.Decimal128.fromString(amount.toString()),
      currency,
      status: "pending",
      paymentUrl: invoiceUrl,
      payCurrency: invoiceResponse.pay_currency || undefined,
      meta: { type: "voucher_purchase", voucherId: voucher.voucherId },
    });

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "Voucher payment invoice created successfully",
      data: {
        voucher: {
          id: voucher._id,
          voucherId: voucher.voucherId,
          amount: parseFloat(voucher.amount.toString()),
          investmentValue: parseFloat(voucher.investmentValue.toString()),
          multiplier: voucher.multiplier,
          status: voucher.status,
          expiry: voucher.expiry,
        },
        payment: {
          paymentId: invoiceResponse.id || invoiceResponse.token,
          invoiceId: invoiceResponse.id,
          invoiceToken: invoiceResponse.token,
          paymentUrl: invoiceUrl,
          priceAmount: invoiceResponse.price_amount,
          priceCurrency: invoiceResponse.price_currency,
          orderId: invoiceResponse.order_id || orderId,
          status: "pending",
        },
        orderId,
      },
    });
  } catch (error: any) {
    console.error("NOWPayments voucher payment creation error:", error);
    throw new AppError(
      error.message || "Failed to create voucher payment request",
      500
    );
  }
});

/**
 * Update user wallet address
 * PUT /api/v1/user/wallet-address
 */
export const updateWalletAddress = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { walletAddress, bankAccount } = req.body;

  const updateData: any = {};
  if (walletAddress) {
    updateData.walletAddress = walletAddress;
  }
  if (bankAccount) {
    updateData.bankAccount = bankAccount;
  }

  const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        walletAddress: user.walletAddress,
        bankAccount: user.bankAccount,
      },
    },
  });
});

/**
 * Get user referral links
 * GET /api/v1/user/referral-links
 */
export const getUserReferralLinks = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const leftLink = `${baseUrl}/signup?referrer=${user.userId}&position=left`;
  const rightLink = `${baseUrl}/signup?referrer=${user.userId}&position=right`;

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      leftLink,
      rightLink,
      userId: user.userId,
    },
  });
});

/**
 * Exchange funds between wallets
 * POST /api/v1/user/wallet-exchange
 */
export const exchangeWalletFunds = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { fromWalletType, toWalletType, amount, exchangeRate } = req.body;

  if (!fromWalletType || !toWalletType || !amount) {
    throw new AppError("From wallet type, to wallet type, and amount are required", 400);
  }

  if (amount <= 0) {
    throw new AppError("Amount must be greater than zero", 400);
  }

  // Validate wallet types
  const validWalletTypes = Object.values(WalletType);
  if (!validWalletTypes.includes(fromWalletType) || !validWalletTypes.includes(toWalletType)) {
    throw new AppError("Invalid wallet type", 400);
  }

  // Perform exchange (default exchange rate is 1:1)
  const result = await exchangeWallets(
    userId,
    fromWalletType,
    toWalletType,
    amount,
    exchangeRate || 1.0
  );

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Wallet exchange completed successfully",
    data: result,
  });
});

/**
 * Get user's career progress (User)
 * GET /api/v1/user/career-progress
 */
/**
 * Create ticket
 * POST /api/v1/user/tickets
 */
export const createTicket = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const body = req.body;
  const { department, service, subject, description, document } = body as {
    department: "Admin support" | "Technical Support";
    service?: "Package Activation" | "Downline Activation" | "Authentication";
    subject: string;
    description?: string;
    document?: string;
  };

  if (!department || !subject) {
    throw new AppError("Department and subject are required", 400);
  }

  if (!["Admin support", "Technical Support"].includes(department)) {
    throw new AppError("Invalid department. Must be 'Admin support' or 'Technical Support'", 400);
  }

  const { Ticket } = await import("../models/Ticket");
  
  const ticket = await Ticket.create({
    raisedBy: userId,
    department,
    service: service || undefined,
    subject,
    description: description || undefined,
    document: document || undefined,
    status: "Open",
  });

  const populatedTicket = await Ticket.findById(ticket._id)
    .populate("raisedBy", "userId name email")
    .lean();

  // Send confirmation email to user
  try {
    if ((populatedTicket?.raisedBy as any)?.email) {
      const { sendTicketCreatedEmail } = await import("../lib/mail-service/email.service");
      sendTicketCreatedEmail({
        to: (populatedTicket.raisedBy as any).email,
        name: (populatedTicket.raisedBy as any).name || "User",
        ticketId: ticket._id.toString(),
        subject: ticket.subject,
        department: ticket.department,
      }).catch((error) => {
        console.error('Failed to send ticket creation email:', error);
      });
    }
  } catch (error) {
    console.error('Error preparing ticket creation email:', error);
  }

  const response = res as any;
  response.status(201).json({
    status: "success",
    message: "Ticket created successfully",
    data: {
      ticket: {
        id: ticket._id,
        raisedBy: {
          userId: (populatedTicket?.raisedBy as any)?.userId || "N/A",
          name: (populatedTicket?.raisedBy as any)?.name || "Unknown",
          email: (populatedTicket?.raisedBy as any)?.email || "N/A",
        },
        department: ticket.department,
        service: ticket.service,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        document: ticket.document,
        createdAt: ticket.createdAt,
      },
    },
  });
});

/**
 * Get user tickets
 * GET /api/v1/user/tickets
 */
export const getUserTickets = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { Ticket } = await import("../models/Ticket");
  const tickets = await Ticket.find({ raisedBy: userId })
    .sort({ createdAt: -1 })
    .lean();

  const formattedTickets = tickets.map((ticket) => ({
    id: ticket._id,
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
    },
  });
});

export const getUserCareerProgressController = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const progress = await getUserCareerProgress(userId);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      progress: progress || {
        currentLevel: null,
        currentLevelName: null,
        levelInvestment: 0,
        totalBusinessVolume: 0,
        completedLevels: [],
        totalRewardsEarned: 0,
        lastCheckedAt: null,
      },
    },
  });
});

