// models/types.ts
import { Schema } from "mongoose";

export enum WalletType {
  WITHDRAWAL = "withdrawal",
  ROI = "roi",
  REFERRAL_BINARY = "referral_binary",
  INTEREST = "interest",
  REFERRAL = "referral",
  BINARY = "binary",
  TOKEN = "token",
  INVESTMENT = "investment",
}

export enum TxnStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  REVERSED = "reversed"
}

export enum WithdrawalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

export enum Position {
  LEFT = "left",
  RIGHT = "right"
}
