// models/WalletTransaction.ts
import { Schema, model, Document, Types } from "mongoose";
import { TxnStatus } from "./types";

export interface IWalletTransaction extends Document {
  idempotencyKey?: string; // from provider or API call
  txRef?: string; // external reference (paymentId, investmentId)
  user: Types.ObjectId;
  wallet: Types.ObjectId;
  type: "credit" | "debit";
  amount: Types.Decimal128;
  currency?: string;
  balanceBefore: Types.Decimal128;
  balanceAfter: Types.Decimal128;
  status: TxnStatus;
  meta?: Record<string, any>;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>({
  idempotencyKey: { type: String, index: true, sparse: true },
  txRef: { type: String, index: true, sparse: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  wallet: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
  type: { type: String, enum: ["credit","debit"], required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  currency: { type: String },
  balanceBefore: { type: Schema.Types.Decimal128, required: true },
  balanceAfter: { type: Schema.Types.Decimal128, required: true },
  status: { type: String, enum: Object.values(TxnStatus), default: TxnStatus.COMPLETED },
  meta: { type: Schema.Types.Mixed }
}, { timestamps: true });

WalletTransactionSchema.index({ user: 1, createdAt: -1 });

export const WalletTransaction = model<IWalletTransaction>("WalletTransaction", WalletTransactionSchema);
