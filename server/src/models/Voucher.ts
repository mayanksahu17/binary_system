// models/Voucher.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IVoucher extends Document {
  voucherId: string;
  user: Types.ObjectId; // owner
  fromWallet?: Types.ObjectId;
  amount: Types.Decimal128;
  originalAmount?: Types.Decimal128;
  createdBy?: Types.ObjectId;
  createdOn: Date;
  usedAt?: Date | null;
  expiry?: Date | null;
  status: "active" | "used" | "expired" | "revoked";
}

const VoucherSchema = new Schema<IVoucher>({
  voucherId: { type: String, required: true, unique: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fromWallet: { type: Schema.Types.ObjectId, ref: "Wallet" },
  amount: { type: Schema.Types.Decimal128, required: true },
  originalAmount: { type: Schema.Types.Decimal128 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdOn: { type: Date, default: () => new Date() },
  usedAt: { type: Date, default: null },
  expiry: { type: Date, default: null },
  status: { type: String, enum: ["active","used","expired","revoked"], default: "active" }
}, { timestamps: true });

export const Voucher = model<IVoucher>("Voucher", VoucherSchema);
