import { Types } from "mongoose";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { WalletType, TxnStatus } from "../models/types";
import { AppError } from "../utills/AppError";

/**
 * Create a wallet transaction record
 */
export async function createWalletTransaction(
  userId: Types.ObjectId,
  walletType: WalletType,
  type: "credit" | "debit",
  amount: number,
  txRef?: string,
  meta?: Record<string, any>
) {
  try {
    // Get wallet
    let wallet = await Wallet.findOne({ user: userId, type: walletType });
    
    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await Wallet.create({
        user: userId,
        type: walletType,
        balance: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }

    const balanceBefore = parseFloat(wallet.balance.toString());
    const balanceAfter = type === "credit" 
      ? balanceBefore + amount 
      : balanceBefore - amount;

    // Create transaction record
    const transaction = await WalletTransaction.create({
      user: userId,
      wallet: wallet._id,
      type,
      amount: Types.Decimal128.fromString(amount.toString()),
      currency: wallet.currency || "USD",
      balanceBefore: Types.Decimal128.fromString(balanceBefore.toString()),
      balanceAfter: Types.Decimal128.fromString(balanceAfter.toString()),
      status: TxnStatus.COMPLETED,
      txRef,
      meta: meta || {},
    });

    return transaction;
  } catch (error) {
    console.error("Error creating wallet transaction:", error);
    // Don't throw - transaction recording shouldn't fail the main operation
    return null;
  }
}

/**
 * Create ROI transaction with cashable and renewable portions
 */
export async function createROITransaction(
  userId: Types.ObjectId,
  totalAmount: number,
  cashableAmount: number,
  renewableAmount: number,
  investmentId?: string
) {
  return createWalletTransaction(
    userId,
    WalletType.ROI,
    "credit",
    totalAmount,
    investmentId,
    { 
      type: "roi_payout", 
      source: "daily_cron",
      cashableAmount,
      renewableAmount,
      totalAmount
    }
  );
}

/**
 * Create referral transaction
 */
export async function createReferralTransaction(
  userId: Types.ObjectId,
  amount: number,
  fromUserId?: string,
  investmentId?: string
) {
  return createWalletTransaction(
    userId,
    WalletType.REFERRAL,
    "credit",
    amount,
    investmentId,
    { type: "referral", fromUser: fromUserId }
  );
}

/**
 * Create binary transaction
 */
export async function createBinaryTransaction(
  userId: Types.ObjectId,
  amount: number,
  fromUserId?: string,
  investmentId?: string
) {
  return createWalletTransaction(
    userId,
    WalletType.BINARY,
    "credit",
    amount,
    investmentId,
    { type: "binary", fromUser: fromUserId }
  );
}

/**
 * Create investment transaction
 */
export async function createInvestmentTransaction(
  userId: Types.ObjectId,
  amount: number,
  investmentId: string
) {
  return createWalletTransaction(
    userId,
    WalletType.INVESTMENT,
    "credit",
    amount,
    investmentId,
    { type: "investment" }
  );
}

