// models/types.ts
import { Schema } from "mongoose";

export enum WalletType {
  WITHDRAWAL = "withdrawal",
  ROI = "roi",
  INTEREST = "interest",
  REFERRAL = "referral",
  BINARY = "binary",
  TOKEN = "token",
  INVESTMENT = "investment",
  CAREER_LEVEL = "career_level",
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
