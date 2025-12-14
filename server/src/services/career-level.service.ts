import { Types } from "mongoose";
import { CareerLevel, ICareerLevel } from "../models/CareerLevel";
import { UserCareerProgress } from "../models/UserCareerProgress";
import { BinaryTree } from "../models/BinaryTree";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { AppError } from "../utills/AppError";
import { updateWallet } from "./investment.service";
import { createWalletTransaction } from "./transaction.service";

/**
 * Check and award career levels for a user
 * This should be called whenever business volume is added to a user
 */
export async function checkAndAwardCareerLevels(userId: Types.ObjectId): Promise<void> {
  try {
    // Get user's binary tree to calculate total business volume
    const userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree) {
      return; // No tree, no business volume
    }

    const leftBusiness = parseFloat(userTree.leftBusiness.toString());
    const rightBusiness = parseFloat(userTree.rightBusiness.toString());
    const totalBusinessVolume = leftBusiness + rightBusiness;

    // Get all active career levels, sorted by level (ascending)
    const activeLevels = await CareerLevel.find({ status: "Active" })
      .sort({ level: 1 })
      .lean();

    // Get or create user career progress
    let userProgress = await UserCareerProgress.findOne({ user: userId });
    if (!userProgress) {
      // Set first level as current when creating progress
      const firstLevel = activeLevels.length > 0 ? activeLevels[0] : null;
      userProgress = await UserCareerProgress.create({
        user: userId,
        levelInvestment: Types.Decimal128.fromString("0"),
        totalBusinessVolume: Types.Decimal128.fromString("0"),
        completedLevels: [],
        totalRewardsEarned: Types.Decimal128.fromString("0"),
        currentLevel: firstLevel ? firstLevel._id as Types.ObjectId : null,
        currentLevelName: firstLevel ? firstLevel.name : null,
      });
    }

    // Update total business volume
    userProgress.totalBusinessVolume = Types.Decimal128.fromString(totalBusinessVolume.toString());

    if (activeLevels.length === 0) {
      // No career levels defined, just update progress and return
      userProgress.currentLevel = null;
      userProgress.currentLevelName = null;
      userProgress.lastCheckedAt = new Date();
      await userProgress.save();
      return;
    }

    // If user has no current level set, set first level as current
    if (!userProgress.currentLevel && activeLevels.length > 0) {
      userProgress.currentLevel = activeLevels[0]._id as Types.ObjectId;
      userProgress.currentLevelName = activeLevels[0].name;
    }

    // Find the highest completed level
    const initialCompletedLevelIds = userProgress.completedLevels.map((cl) => cl.levelId.toString());
    const highestCompletedLevel = activeLevels
      .filter((level) => initialCompletedLevelIds.includes(level._id.toString()))
      .sort((a, b) => b.level - a.level)[0];

    // CRITICAL FIX: Check all levels that can be completed based on total business volume
    // Thresholds are cumulative - each level needs its threshold amount of total business
    // Loop through all active levels and check if totalBusinessVolume >= threshold
    
    let nextLevelToCheck: ICareerLevel | null = null;
    let levelsCompleted = 0;
    
    // Find all levels that should be completed based on total business volume
    // Check each level in order, starting from the first uncompleted level
    const completedLevelIds = userProgress.completedLevels.map((cl) => cl.levelId.toString());
    
    for (const level of activeLevels) {
      const levelIdStr = level._id.toString();
      const isAlreadyCompleted = completedLevelIds.includes(levelIdStr);
      const levelThreshold = parseFloat(level.investmentThreshold.toString());
      
      // CRITICAL: Career level rewards should only trigger when BOTH sides (left AND right) meet the business volume threshold
      // Both leftBusiness and rightBusiness must be >= levelThreshold
      if (!isAlreadyCompleted && leftBusiness >= levelThreshold && rightBusiness >= levelThreshold) {
        const rewardAmount = parseFloat(level.rewardAmount.toString());

        // Award the reward to career level wallet
        await updateWallet(userId, WalletType.CAREER_LEVEL, rewardAmount, "add");

        // Create transaction record
        await createWalletTransaction(
          userId,
          WalletType.CAREER_LEVEL,
          "credit",
          rewardAmount,
          undefined,
          {
            type: "career_reward",
            levelId: levelIdStr,
            levelName: level.name,
            levelNumber: level.level,
          }
        );

        // Update user progress
        userProgress.completedLevels.push({
          levelId: level._id as Types.ObjectId,
          levelName: level.name,
          completedAt: new Date(),
          rewardAmount: Types.Decimal128.fromString(rewardAmount.toString()),
        });

        // Update total rewards
        const currentTotalRewards = parseFloat(userProgress.totalRewardsEarned.toString());
        userProgress.totalRewardsEarned = Types.Decimal128.fromString(
          (currentTotalRewards + rewardAmount).toString()
        );

        levelsCompleted++;

        console.log(
          `[Career Level] User ${userId} completed level ${level.name} and received $${rewardAmount} reward`
        );
      }
    }

    // Find the next level to achieve (first uncompleted level)
    const updatedCompletedLevelIds = userProgress.completedLevels.map((cl) => cl.levelId.toString());
    for (const level of activeLevels) {
      if (!updatedCompletedLevelIds.includes(level._id.toString())) {
        nextLevelToCheck = level;
        break;
      }
    }

    // Calculate level investment progress for the next level
    // Level investment = total business volume - highest completed level threshold
    // This represents progress towards the next level
    let finalLevelInvestment = 0;
    
    if (userProgress.completedLevels.length > 0) {
      // Find the highest completed level threshold
      const highestCompletedLevelThreshold = userProgress.completedLevels.reduce((max, cl) => {
        const level = activeLevels.find((l) => l._id.toString() === cl.levelId.toString());
        const threshold = level ? parseFloat(level.investmentThreshold.toString()) : 0;
        return Math.max(max, threshold);
      }, 0);
      
      // Level investment is the amount beyond the highest completed threshold
      // This represents progress towards the next level
      finalLevelInvestment = Math.max(0, totalBusinessVolume - highestCompletedLevelThreshold);
    } else {
      // No levels completed yet, level investment equals total business volume
      finalLevelInvestment = totalBusinessVolume;
    }

    // Update level investment and current level after all completions
    if (nextLevelToCheck) {
      // Still have a level to work towards
      userProgress.currentLevel = nextLevelToCheck._id as Types.ObjectId;
      userProgress.currentLevelName = nextLevelToCheck.name;
      userProgress.levelInvestment = Types.Decimal128.fromString(Math.max(0, finalLevelInvestment).toString());
    } else if (userProgress.completedLevels.length === 0 && activeLevels.length > 0) {
      // No levels completed yet, set first level as current
      const firstLevel = activeLevels[0];
      userProgress.currentLevel = firstLevel._id as Types.ObjectId;
      userProgress.currentLevelName = firstLevel.name;
      userProgress.levelInvestment = Types.Decimal128.fromString(Math.max(0, finalLevelInvestment).toString());
    } else {
      // All levels completed
      userProgress.currentLevel = null;
      userProgress.currentLevelName = null;
      userProgress.levelInvestment = Types.Decimal128.fromString("0");
    }

    userProgress.lastCheckedAt = new Date();
    await userProgress.save();
  } catch (error) {
    console.error(`[Career Level] Error checking career levels for user ${userId}:`, error);
    // Don't throw error - career level checking should not break the main flow
  }
}

/**
 * Get user's career progress
 */
export async function getUserCareerProgress(userId: Types.ObjectId) {
  const progress = await UserCareerProgress.findOne({ user: userId })
    .populate("currentLevel")
    .lean();

  if (!progress) {
    // If no progress exists, initialize it with first level
    const activeLevels = await CareerLevel.find({ status: "Active" })
      .sort({ level: 1 })
      .lean();
    
    const firstLevel = activeLevels.length > 0 ? activeLevels[0] : null;
    
    return {
      currentLevel: firstLevel
        ? {
            id: firstLevel._id.toString(),
            name: firstLevel.name,
            level: firstLevel.level,
            investmentThreshold: parseFloat(firstLevel.investmentThreshold.toString()),
            rewardAmount: parseFloat(firstLevel.rewardAmount.toString()),
          }
        : null,
      currentLevelName: firstLevel ? firstLevel.name : null,
      levelInvestment: 0,
      totalBusinessVolume: 0,
      completedLevels: [],
      totalRewardsEarned: 0,
      lastCheckedAt: null,
    };
  }

  // If progress exists but no current level is set, set it to first level
  if (!progress.currentLevel) {
    const activeLevels = await CareerLevel.find({ status: "Active" })
      .sort({ level: 1 })
      .lean();
    
    if (activeLevels.length > 0 && progress.completedLevels.length === 0) {
      const firstLevel = activeLevels[0];
      // Update the progress record
      await UserCareerProgress.updateOne(
        { _id: progress._id },
        {
          currentLevel: firstLevel._id,
          currentLevelName: firstLevel.name,
        }
      );
      
      return {
        currentLevel: {
          id: firstLevel._id.toString(),
          name: firstLevel.name,
          level: firstLevel.level,
          investmentThreshold: parseFloat(firstLevel.investmentThreshold.toString()),
          rewardAmount: parseFloat(firstLevel.rewardAmount.toString()),
        },
        currentLevelName: firstLevel.name,
        levelInvestment: parseFloat(progress.levelInvestment.toString()),
        totalBusinessVolume: parseFloat(progress.totalBusinessVolume.toString()),
        completedLevels: progress.completedLevels.map((cl) => ({
          levelId: cl.levelId.toString(),
          levelName: cl.levelName,
          completedAt: cl.completedAt,
          rewardAmount: parseFloat(cl.rewardAmount.toString()),
        })),
        totalRewardsEarned: parseFloat(progress.totalRewardsEarned.toString()),
        lastCheckedAt: progress.lastCheckedAt,
      };
    }
  }

  return {
    currentLevel: progress.currentLevel
      ? {
          id: (progress.currentLevel as any)._id,
          name: (progress.currentLevel as any).name,
          level: (progress.currentLevel as any).level,
          investmentThreshold: parseFloat((progress.currentLevel as any).investmentThreshold.toString()),
          rewardAmount: parseFloat((progress.currentLevel as any).rewardAmount.toString()),
        }
      : null,
    currentLevelName: progress.currentLevelName,
    levelInvestment: parseFloat(progress.levelInvestment.toString()),
    totalBusinessVolume: parseFloat(progress.totalBusinessVolume.toString()),
    completedLevels: progress.completedLevels.map((cl) => ({
      levelId: cl.levelId.toString(),
      levelName: cl.levelName,
      completedAt: cl.completedAt,
      rewardAmount: parseFloat(cl.rewardAmount.toString()),
    })),
    totalRewardsEarned: parseFloat(progress.totalRewardsEarned.toString()),
    lastCheckedAt: progress.lastCheckedAt,
  };
}

