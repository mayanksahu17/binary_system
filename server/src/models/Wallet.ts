// models/Wallet.ts
import { Schema, model, Document, Types } from "mongoose";
import { WalletType } from "./types";

export interface IWallet extends Document {
  user: Types.ObjectId;
  type: WalletType;
  balance: Types.Decimal128; // Cashable balance (withdrawable)
  renewablePrincipal?: Types.Decimal128; // Non-withdrawable renewable principal (accumulated from ROI)
  currency?: string; // 'USD' / 'INR' / 'USDT' etc
  reserved?: Types.Decimal128; // blocked amount
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: Object.values(WalletType), required: true },
  balance: { type: Schema.Types.Decimal128, required: true, default: "0" }, // Cashable balance
  renewablePrincipal: { type: Schema.Types.Decimal128, default: "0" }, // Non-withdrawable renewable principal
  reserved: { type: Schema.Types.Decimal128, required: true, default: "0" },
  currency: { type: String, default: "USD" },
}, { timestamps: true });

WalletSchema.index({ user: 1, type: 1 }, { unique: true }); // one wallet per user/type

export const Wallet = model<IWallet>("Wallet", WalletSchema);
