// models/Package.ts (master_table_packages)
import mongoose, { Schema, model, Document , } from "mongoose";

export interface IPackage extends Document {
  minAmount: mongoose.Types.Decimal128;
  maxAmount: mongoose.Types.Decimal128;
  duration: number; // duration_days
  totalOutputPct: number; // total_output_pct (default 225%)
  renewablePrinciplePct: number; // renewable_principle_pct (default 50%)
  referralPct: number; // referral_pct (default 7%)
  binaryPct: number; // binary_pct (default 10%)
  powerCapacity: mongoose.Types.Decimal128; // power_capacity / capping limit (default $1000)
  packageName: string;
  status: "Active"|"InActive";
  // Legacy fields (for backward compatibility)
  roi?: number; // percentage (deprecated, use totalOutputPct)
  binaryBonus?: number; // (deprecated, use binaryPct)
  cappingLimit?: mongoose.Types.Decimal128; // (deprecated, use powerCapacity)
  principleReturn?: number; // (deprecated, use renewablePrinciplePct)
  levelOneReferral?: number; // (deprecated, use referralPct)
}

const PackageSchema = new Schema<IPackage>({
  minAmount: { type: Schema.Types.Decimal128, required: true },
  maxAmount: { type: Schema.Types.Decimal128, required: true },
  duration: { type: Number, required: true, default: 150 }, // duration_days
  totalOutputPct: { type: Number, default: 225 }, // total_output_pct (225% default)
  renewablePrinciplePct: { type: Number, default: 50 }, // renewable_principle_pct (50% default)
  referralPct: { type: Number, default: 7 }, // referral_pct (7% default)
  binaryPct: { type: Number, default: 10 }, // binary_pct (10% default)
  powerCapacity: { type: Schema.Types.Decimal128, default: "1000" }, // power_capacity ($1000 default)
  packageName: { type: String, required: true },
  status: { type: String, enum: ["Active","InActive"], default: "Active" },
  // Legacy fields for backward compatibility
  roi: { type: Number, default: 0 },
  binaryBonus: { type: Number, default: 0 },
  cappingLimit: { type: Schema.Types.Decimal128, default: "0" },
  principleReturn: { type: Number, default: 0 },
  levelOneReferral: { type: Number, default: 0 },
}, { timestamps: true });

export const Package = model<IPackage>("Package", PackageSchema);
