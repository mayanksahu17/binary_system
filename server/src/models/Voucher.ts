// models/Voucher.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IVoucher extends Document {
  voucherId: string;
  user: Types.ObjectId; // owner
  fromWallet?: Types.ObjectId;
  amount: Types.Decimal128; // Purchase amount
  investmentValue: Types.Decimal128; // Investment value (amount * multiplier, typically 2x)
  multiplier: number; // Multiplier for investment value (default 2)
  originalAmount?: Types.Decimal128;
  createdBy?: Types.ObjectId;
  createdOn: Date;
  usedAt?: Date | null;
  expiry?: Date | null;
  status: "active" | "used" | "expired" | "revoked";
  paymentId?: string; // Payment ID if purchased via gateway
  orderId?: string; // Order ID if purchased via gateway
}

const VoucherSchema = new Schema<IVoucher>({
  voucherId: { type: String, required: true, unique: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fromWallet: { type: Schema.Types.ObjectId, ref: "Wallet" },
  amount: { type: Schema.Types.Decimal128, required: true }, // Purchase amount
  investmentValue: { type: Schema.Types.Decimal128, required: true }, // Investment value (amount * multiplier)
  multiplier: { type: Number, default: 2 }, // Multiplier (default 2x)
  originalAmount: { type: Schema.Types.Decimal128 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdOn: { type: Date, default: () => new Date() },
  usedAt: { type: Date, default: null },
  expiry: { type: Date, default: null },
  status: { type: String, enum: ["active","used","expired","revoked"], default: "active" },
  paymentId: { type: String }, // Payment ID if purchased via gateway
  orderId: { type: String }, // Order ID if purchased via gateway
}, { timestamps: true });

export const Voucher = model<IVoucher>("Voucher", VoucherSchema);
