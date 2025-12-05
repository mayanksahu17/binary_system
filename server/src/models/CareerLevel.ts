import mongoose, { Document, Schema } from "mongoose";

export interface ICareerLevel extends Document {
  name: string; // e.g., "Bronze", "Silver", "Gold", "Platinum"
  investmentThreshold: mongoose.Types.Decimal128; // Total business volume required (left + right)
  rewardAmount: mongoose.Types.Decimal128; // Reward amount in USD
  level: number; // Level number (1, 2, 3, 4...) for ordering
  status: "Active" | "InActive";
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CareerLevelSchema = new Schema<ICareerLevel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    investmentThreshold: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    rewardAmount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Active", "InActive"],
      default: "Active",
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
CareerLevelSchema.index({ level: 1 });
CareerLevelSchema.index({ status: 1 });

export const CareerLevel = mongoose.model<ICareerLevel>("CareerLevel", CareerLevelSchema);

