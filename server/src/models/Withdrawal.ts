// models/Withdrawal.ts
import { Schema, model, Document, Types } from "mongoose";
import { WithdrawalStatus } from "./types";

export interface IWithdrawal extends Document {
  user: Types.ObjectId;
  amount: Types.Decimal128;
  charges: Types.Decimal128;
  cryptoType?: string;
  walletType: "roi"|"interest"|"r&b"|"withdrawal"|"career_level"|"referral"|"binary";
  status: WithdrawalStatus;
  finalAmount: Types.Decimal128;
  merchant?: string;
  withdrawalId?: string; // external id
  method?: "regular"|"card"|"crypto"|"bank";
  createdAt: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  charges: { type: Schema.Types.Decimal128, default: "0" },
  cryptoType: { type: String },
  walletType: { type: String, enum: ["roi","interest","r&b","withdrawal","career_level","referral","binary"], required: true },
  status: { type: String, enum: Object.values(WithdrawalStatus), default: WithdrawalStatus.PENDING },
  finalAmount: { type: Schema.Types.Decimal128, required: true },
  merchant: { type: String },
  withdrawalId: { type: String, index: true, sparse: true },
  method: { type: String, enum: ["regular","card","crypto","bank"], default: "regular" }
}, { timestamps: true });

export const Withdrawal = model<IWithdrawal>("Withdrawal", WithdrawalSchema);
