// models/Investment.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IInvestment extends Document {
  user: Types.ObjectId;
  sponsor?: Types.ObjectId;
  packageId?: Types.ObjectId;
  investedAmount: Types.Decimal128; // Initial invested amount
  principal: Types.Decimal128; // Current principal (changes with renewable principle)
  depositAmount: Types.Decimal128;
  tokenAmount?: Types.Decimal128;
  type: "self"|"powerleg"|"downline"|"free"|"career_reward"|"admin";
  isBinaryUpdated: boolean;
  referralPaid: boolean; // Track if referral bonus was paid (one-time)
  voucherId?: string;
  startDate: Date; // Package activation date
  endDate: Date; // Package expiration date
  durationDays: number; // Duration in days
  totalOutputPct: number; // Total output percentage (e.g., 225)
  dailyRoiRate: number; // Computed: (totalOutputPct/100) / durationDays
  daysElapsed: number; // Days since activation
  daysRemaining: number; // Days remaining
  createdAt: Date;
  expiresOn?: Date | null; // Legacy field (use endDate)
  lastRoiDate?: Date; // Last date ROI was calculated
  totalRoiEarned?: Types.Decimal128; // Total ROI earned so far (cash payout only, excludes reinvest)
  totalReinvested?: Types.Decimal128; // Total amount reinvested into principal
  isActive: boolean; // Whether investment is still active
}

const InvestmentSchema = new Schema<IInvestment>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sponsor: { type: Schema.Types.ObjectId, ref: "User" },
  packageId: { type: Schema.Types.ObjectId, ref: "Package" },
  investedAmount: { type: Schema.Types.Decimal128, required: true },
  principal: { type: Schema.Types.Decimal128, required: true }, // Starts equal to investedAmount
  depositAmount: { type: Schema.Types.Decimal128, required: true },
  tokenAmount: { type: Schema.Types.Decimal128 },
  type: { type: String, enum: ["self","powerleg","downline","free","career_reward","admin"], default: "self" },
  isBinaryUpdated: { type: Boolean, default: false },
  referralPaid: { type: Boolean, default: false },
  voucherId: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  durationDays: { type: Number, required: true },
  totalOutputPct: { type: Number, required: true },
  dailyRoiRate: { type: Number, required: true },
  daysElapsed: { type: Number, default: 0 },
  daysRemaining: { type: Number, required: true },
  lastRoiDate: { type: Date },
  totalRoiEarned: { type: Schema.Types.Decimal128, default: "0" },
  totalReinvested: { type: Schema.Types.Decimal128, default: "0" },
  expiresOn: { type: Date }, // Legacy field
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Investment = model<IInvestment>("Investment", InvestmentSchema);
