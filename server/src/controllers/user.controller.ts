import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { Wallet } from "../models/Wallet";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { BinaryTree } from "../models/BinaryTree";
import { WalletTransaction } from "../models/WalletTransaction";
import { Withdrawal } from "../models/Withdrawal";
import { Voucher } from "../models/Voucher";
import { User } from "../models/User";
import { WalletType, WithdrawalStatus } from "../models/types";
import { processInvestment } from "../services/investment.service";
import { processMockPayment } from "../lib/payments/mock-nowpayments";
import { exchangeWallets } from "../services/wallet-exchange.service";
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
  const { packageId, amount, currency = "USD" } = body;

  if (!packageId || !amount) {
    throw new AppError("Package ID and amount are required", 400);
  }

  if (!Types.ObjectId.isValid(packageId)) {
    throw new AppError("Invalid package ID", 400);
  }

  // Process mock payment
  const paymentResult = await processMockPayment({
    amount: Number(amount),
    currency,
    packageId,
    userId,
  });

  if (!paymentResult.success) {
    throw new AppError(paymentResult.message || "Payment failed", 400);
  }

  // Process investment
  const investment = await processInvestment(
    new Types.ObjectId(userId),
    new Types.ObjectId(packageId),
    Number(amount),
    paymentResult.paymentId
  );

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

  // Get withdrawals
  const withdrawals = await Withdrawal.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

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
 * GET /api/v1/user/vouchers
 */
export const getUserVouchers = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const vouchers = await Voucher.find({ user: userId })
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
 * Create voucher (with mock payment)
 * POST /api/v1/user/vouchers/create
 */
export const createVoucher = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { amount, fromWalletType } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError("Invalid voucher amount", 400);
  }

  // Get wallet if specified
  let fromWallet = null;
  if (fromWalletType) {
    fromWallet = await Wallet.findOne({ user: userId, type: fromWalletType });
    if (!fromWallet) {
      throw new AppError(`Wallet of type ${fromWalletType} not found`, 404);
    }

    const currentBalance = parseFloat(fromWallet.balance.toString());
    if (amount > currentBalance) {
      throw new AppError("Insufficient balance", 400);
    }
  }

  // Generate unique voucher ID
  const voucherId = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Create voucher
  const voucher = await Voucher.create({
    voucherId,
    user: userId,
    fromWallet: fromWallet?._id,
    amount: Types.Decimal128.fromString(amount.toString()),
    originalAmount: Types.Decimal128.fromString(amount.toString()),
    createdBy: userId,
    status: "active",
    expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  });

  // If from wallet, deduct amount
  if (fromWallet) {
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
  }

  const response = res as any;
  response.status(201).json({
    status: "success",
    data: {
      voucher: {
        id: voucher._id,
        voucherId: voucher.voucherId,
        amount: parseFloat(voucher.amount.toString()),
        status: voucher.status,
        expiry: voucher.expiry,
        createdAt: (voucher as any).createdAt,
      },
    },
  });
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

