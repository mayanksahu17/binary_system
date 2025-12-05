import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUserCareerProgress extends Document {
  user: Types.ObjectId;
  currentLevel?: Types.ObjectId; // Reference to current career level
  currentLevelName?: string; // e.g., "Bronze", "Silver"
  levelInvestment: mongoose.Types.Decimal128; // Investment progress for current level (resets after each level)
  totalBusinessVolume: mongoose.Types.Decimal128; // Total business volume (left + right) - cumulative
  completedLevels: Array<{
    levelId: Types.ObjectId;
    levelName: string;
    completedAt: Date;
    rewardAmount: mongoose.Types.Decimal128;
  }>;
  totalRewardsEarned: mongoose.Types.Decimal128; // Total career rewards earned
  lastCheckedAt?: Date; // Last time career level was checked
  createdAt: Date;
  updatedAt: Date;
}

const UserCareerProgressSchema = new Schema<IUserCareerProgress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    currentLevel: {
      type: Schema.Types.ObjectId,
      ref: "CareerLevel",
      default: null,
    },
    currentLevelName: {
      type: String,
      default: null,
    },
    levelInvestment: {
      type: Schema.Types.Decimal128,
      default: Types.Decimal128.fromString("0"),
    },
    totalBusinessVolume: {
      type: Schema.Types.Decimal128,
      default: Types.Decimal128.fromString("0"),
    },
    completedLevels: [
      {
        levelId: {
          type: Schema.Types.ObjectId,
          ref: "CareerLevel",
        },
        levelName: String,
        completedAt: Date,
        rewardAmount: Schema.Types.Decimal128,
      },
    ],
    totalRewardsEarned: {
      type: Schema.Types.Decimal128,
      default: Types.Decimal128.fromString("0"),
    },
    lastCheckedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
UserCareerProgressSchema.index({ user: 1 });
UserCareerProgressSchema.index({ currentLevel: 1 });

export const UserCareerProgress = mongoose.model<IUserCareerProgress>(
  "UserCareerProgress",
  UserCareerProgressSchema
);

