import { Types } from "mongoose";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { WalletType, TxnStatus } from "../models/types";
import { AppError } from "../utills/AppError";

/**
 * Exchange funds between two wallets
 * @param userId - User ID
 * @param fromWalletType - Source wallet type
 * @param toWalletType - Destination wallet type
 * @param amount - Amount to exchange
 * @param exchangeRate - Optional exchange rate (default 1:1)
 * @returns Transaction details
 */
export async function exchangeWallets(
  userId: Types.ObjectId,
  fromWalletType: WalletType,
  toWalletType: WalletType,
  amount: number,
  exchangeRate: number = 1.0
) {
  try {
    // Validation
    if (amount <= 0) {
      throw new AppError("Amount must be greater than zero", 400);
    }

    if (fromWalletType === toWalletType) {
      throw new AppError("Source and destination wallets cannot be the same", 400);
    }

    // Validate wallet types
    const validWalletTypes = Object.values(WalletType);
    if (!validWalletTypes.includes(fromWalletType) || !validWalletTypes.includes(toWalletType)) {
      throw new AppError("Invalid wallet type", 400);
    }

    // Get source wallet
    let fromWallet = await Wallet.findOne({ user: userId, type: fromWalletType });
    if (!fromWallet) {
      // Create wallet if it doesn't exist
      fromWallet = await Wallet.create({
        user: userId,
        type: fromWalletType,
        balance: Types.Decimal128.fromString("0"),
        renewablePrincipal: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }

    // Get destination wallet
    let toWallet = await Wallet.findOne({ user: userId, type: toWalletType });
    if (!toWallet) {
      // Create wallet if it doesn't exist
      toWallet = await Wallet.create({
        user: userId,
        type: toWalletType,
        balance: Types.Decimal128.fromString("0"),
        renewablePrincipal: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }

    // Check available balance (balance - reserved)
    const fromBalance = parseFloat(fromWallet.balance.toString());
    const fromReserved = parseFloat(fromWallet.reserved?.toString() || "0");
    const availableBalance = fromBalance - fromReserved;

    if (availableBalance < amount) {
      throw new AppError(
        `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`,
        400
      );
    }

    // Calculate destination amount (with exchange rate)
    const destinationAmount = amount * exchangeRate;

    // Update source wallet (debit)
    const newFromBalance = fromBalance - amount;
    fromWallet.balance = Types.Decimal128.fromString(newFromBalance.toString());
    await fromWallet.save();

    // Update destination wallet (credit)
    const toBalance = parseFloat(toWallet.balance.toString());
    const newToBalance = toBalance + destinationAmount;
    toWallet.balance = Types.Decimal128.fromString(newToBalance.toString());
    await toWallet.save();

    // Create transaction records
    const exchangeId = new Types.ObjectId().toString();

    // Debit transaction from source wallet
    await WalletTransaction.create({
      user: userId,
      wallet: fromWallet._id,
      type: "debit",
      amount: Types.Decimal128.fromString(amount.toString()),
      currency: fromWallet.currency || "USD",
      balanceBefore: Types.Decimal128.fromString(fromBalance.toString()),
      balanceAfter: Types.Decimal128.fromString(newFromBalance.toString()),
      status: TxnStatus.COMPLETED,
      txRef: exchangeId,
      meta: {
        type: "wallet_exchange",
        fromWallet: fromWalletType,
        toWallet: toWalletType,
        exchangeRate,
        destinationAmount,
      },
    });

    // Credit transaction to destination wallet
    await WalletTransaction.create({
      user: userId,
      wallet: toWallet._id,
      type: "credit",
      amount: Types.Decimal128.fromString(destinationAmount.toString()),
      currency: toWallet.currency || "USD",
      balanceBefore: Types.Decimal128.fromString(toBalance.toString()),
      balanceAfter: Types.Decimal128.fromString(newToBalance.toString()),
      status: TxnStatus.COMPLETED,
      txRef: exchangeId,
      meta: {
        type: "wallet_exchange",
        fromWallet: fromWalletType,
        toWallet: toWalletType,
        exchangeRate,
        originalAmount: amount,
      },
    });

    return {
      exchangeId,
      fromWallet: {
        type: fromWalletType,
        balanceBefore: fromBalance,
        balanceAfter: newFromBalance,
        amountDebited: amount,
      },
      toWallet: {
        type: toWalletType,
        balanceBefore: toBalance,
        balanceAfter: newToBalance,
        amountCredited: destinationAmount,
      },
      exchangeRate,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to exchange wallets", 500);
  }
}

