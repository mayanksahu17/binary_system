import { Types } from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Investment } from "../models/Investment";
import { Wallet } from "../models/Wallet";
import { Package } from "../models/Package";
import { WalletType } from "../models/types";
import { AppError } from "../utills/AppError";
import {
  createInvestmentTransaction,
  createReferralTransaction,
  createBinaryTransaction,
} from "./transaction.service";
import { initializeBinaryTree, getAdminUser } from "./userInit.service";

/**
 * Calculate daily binary bonuses for all users
 * Per rule book: Active principal counts as business volume each day
 * This function processes all users and calculates binary bonuses using consumption model
 * Should be called daily by cron job
 */
export async function calculateDailyBinaryBonuses() {
  try {
    console.log(`[Binary Cron] Starting daily binary bonus calculation at ${new Date().toISOString()}`);

    // Get all users with binary tree entries
    const allTrees = await BinaryTree.find({}).populate("user").lean();
    console.log(`[Binary Cron] Found ${allTrees.length} binary tree entries`);

    let processedCount = 0;
    let errorCount = 0;
    let totalBinaryPaid = 0;

    // Get default package for binaryPct and powerCapacity (or use defaults)
    const defaultPackage = await Package.findOne({ status: "Active" }).lean();
    const defaultBinaryPct = defaultPackage?.binaryPct || defaultPackage?.binaryBonus || 10;
    const defaultPowerCapacity = parseFloat(
      defaultPackage?.powerCapacity?.toString() || 
      defaultPackage?.cappingLimit?.toString() || 
      "1000"
    );

    // Get all active investments to calculate daily business volume from active principals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeInvestments = await Investment.find({
      isActive: true,
      $or: [
        { endDate: { $gte: today } },
        { expiresOn: { $gte: today } }, // Legacy field
      ],
    })
      .populate("user")
      .lean();

    // Group investments by user and position to calculate daily business volume
    const userDailyBusiness = new Map<string, { left: number; right: number }>();
    
    for (const investment of activeInvestments) {
      const userId = (investment.user as any)?._id?.toString();
      if (!userId) continue;

      const principal = parseFloat(investment.principal?.toString() || investment.investedAmount.toString());
      
      // Get user's position in parent's tree
      const user = await User.findById(userId).select("position referrer").lean();
      if (!user) continue;

      // Determine which leg this investment contributes to
      // If user has a referrer, add to referrer's leg based on user's position
      if (user.referrer) {
        const referrerId = user.referrer.toString();
        const position = (user.position as "left" | "right") || "left";
        
        if (!userDailyBusiness.has(referrerId)) {
          userDailyBusiness.set(referrerId, { left: 0, right: 0 });
        }
        
        const business = userDailyBusiness.get(referrerId)!;
        if (position === "left") {
          business.left += principal;
        } else {
          business.right += principal;
        }
      }
    }

    for (const tree of allTrees) {
      try {
        const userId = tree.user as any;
        if (!userId || !userId._id) {
          continue;
        }

        const userIdStr = userId._id.toString();
        const userIdObj = new Types.ObjectId(userIdStr);

        // Get daily business volume from active principals (per rule book)
        const dailyBusiness = userDailyBusiness.get(userIdStr) || { left: 0, right: 0 };
        
        // Add daily business volume to tree (this represents active principal counting each day)
        // Note: leftBusiness and rightBusiness are cumulative, so we add daily business to them
        if (dailyBusiness.left > 0 || dailyBusiness.right > 0) {
          await addBusinessVolume(userIdObj, dailyBusiness.left, "left");
          await addBusinessVolume(userIdObj, dailyBusiness.right, "right");
        }

        // Get updated tree values after adding daily business
        const updatedTree = await BinaryTree.findOne({ user: userIdObj });
        if (!updatedTree) continue;

        // Check if user has any available volume for matching
        const leftBusiness = parseFloat(updatedTree.leftBusiness?.toString() || "0");
        const rightBusiness = parseFloat(updatedTree.rightBusiness?.toString() || "0");
        const leftCarry = parseFloat(updatedTree.leftCarry?.toString() || "0");
        const rightCarry = parseFloat(updatedTree.rightCarry?.toString() || "0");

        const leftAvailable = leftCarry + (leftBusiness - parseFloat(updatedTree.leftMatched?.toString() || "0"));
        const rightAvailable = rightCarry + (rightBusiness - parseFloat(updatedTree.rightMatched?.toString() || "0"));

        // Skip if no volume available for matching
        if (leftAvailable <= 0 && rightAvailable <= 0) {
          continue;
        }

        // Calculate binary bonus using consumption model
        const binaryResult = await calculateBinaryBonus(
          userIdObj,
          defaultBinaryPct,
          defaultPowerCapacity
        );

        // Add binary bonus to user's binary wallet (cashable)
        if (binaryResult.binaryBonus > 0) {
          await updateWallet(
            userIdObj,
            WalletType.BINARY,
            binaryResult.binaryBonus,
            "add"
          );

          // Create binary transaction
          await createBinaryTransaction(
            userIdObj,
            binaryResult.binaryBonus,
            undefined, // fromUserId (daily calculation, not from specific user)
            undefined // investmentId (daily calculation)
          );

          totalBinaryPaid += binaryResult.binaryBonus;
          processedCount++;
        }
      } catch (error) {
        console.error(`[Binary Cron] Error processing user ${tree.user}:`, error);
        errorCount++;
      }
    }

    console.log(
      `[Binary Cron] Completed: ${processedCount} users processed, ${errorCount} errors, $${totalBinaryPaid.toFixed(2)} total binary paid`
    );

    return {
      processed: processedCount,
      errors: errorCount,
      totalBinaryPaid,
      total: allTrees.length,
    };
  } catch (error) {
    console.error("[Binary Cron] Fatal error:", error);
    throw error;
  }
}

/**
 * Add Business Volume (BV) to a user's binary tree leg
 * When a downline activates a package, their invested amount is added to referrer's leg
 */
export async function addBusinessVolume(
  userId: Types.ObjectId,
  amount: number,
  position: "left" | "right"
) {
  try {
    const userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree) {
      throw new AppError("User binary tree not found", 404);
    }

    // Add BV to the specified leg's business
    const currentBusiness = position === "left" 
      ? parseFloat(userTree.leftBusiness.toString())
      : parseFloat(userTree.rightBusiness.toString());
    
    const newBusiness = currentBusiness + amount;
    
    if (position === "left") {
      userTree.leftBusiness = Types.Decimal128.fromString(newBusiness.toString());
    } else {
      userTree.rightBusiness = Types.Decimal128.fromString(newBusiness.toString());
    }

    await userTree.save();

    return {
      leftBusiness: parseFloat(userTree.leftBusiness.toString()),
      rightBusiness: parseFloat(userTree.rightBusiness.toString()),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to add business volume", 500);
  }
}

/**
 * Calculate and process binary bonus using consumption model
 * This implements the consumption model where matched BV is subtracted from both sides
 * 
 * Formula:
 * - left_available = leftCarry + leftBusiness
 * - right_available = rightCarry + rightBusiness
 * - matched = min(left_available, right_available)
 * - capped_matched = min(matched, power_capacity)
 * - binary_payout = capped_matched * binary_pct/100
 * - Consumption: subtract matched from both sides, leftover goes to carry
 */
export async function calculateBinaryBonus(
  userId: Types.ObjectId,
  binaryPct: number = 10,
  powerCapacity: number = 1000
): Promise<{ binaryBonus: number; matched: number; cappedMatched: number }> {
  try {
    const userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree) {
      throw new AppError("User binary tree not found", 404);
    }

    // Get current values
    const leftBusiness = parseFloat(userTree.leftBusiness.toString()); // Cumulative (never decreases)
    const rightBusiness = parseFloat(userTree.rightBusiness.toString()); // Cumulative (never decreases)
    const leftCarry = parseFloat(userTree.leftCarry.toString()); // Unmatched portion
    const rightCarry = parseFloat(userTree.rightCarry.toString()); // Unmatched portion
    const leftMatched = parseFloat(userTree.leftMatched?.toString() || "0"); // Previously matched from leftBusiness
    const rightMatched = parseFloat(userTree.rightMatched?.toString() || "0"); // Previously matched from rightBusiness

    // Calculate available volume for matching
    // left_available = leftCarry + (leftBusiness - leftMatched)
    // right_available = rightCarry + (rightBusiness - rightMatched)
    // This ensures we only match from unmatched portions
    const leftUnmatchedBusiness = leftBusiness - leftMatched;
    const rightUnmatchedBusiness = rightBusiness - rightMatched;
    const leftAvailable = leftCarry + leftUnmatchedBusiness;
    const rightAvailable = rightCarry + rightUnmatchedBusiness;

    // Find matched volume (minimum of both sides)
    const matched = Math.min(leftAvailable, rightAvailable);

    // Apply power_capacity cap
    const cappedMatched = Math.min(matched, powerCapacity);

    // Calculate binary payout: binary_pct * capped_matched
    const binaryBonus = cappedMatched * (binaryPct / 100);

    // Consumption model: consume matched amount from available pool
    // Priority: consume from carry first, then from unmatched business
    // After matching, update carry forward with leftover
    
    // Calculate how much to consume from carry vs business
    let newLeftCarry = 0;
    let newRightCarry = 0;
    let newLeftMatched = leftMatched;
    let newRightMatched = rightMatched;

    // Left side consumption
    if (cappedMatched > 0) {
      // Consume from leftCarry first, then from unmatched business
      if (leftCarry >= cappedMatched) {
        // All from carry
        newLeftCarry = leftCarry - cappedMatched;
      } else {
        // Some from carry, rest from unmatched business
        const consumedFromCarry = leftCarry;
        const consumedFromBusiness = cappedMatched - leftCarry;
        newLeftCarry = 0; // All carry consumed
        newLeftMatched = leftMatched + consumedFromBusiness;
      }
    } else {
      newLeftCarry = leftCarry;
    }

    // Right side consumption
    if (cappedMatched > 0) {
      // Consume from rightCarry first, then from unmatched business
      if (rightCarry >= cappedMatched) {
        // All from carry
        newRightCarry = rightCarry - cappedMatched;
      } else {
        // Some from carry, rest from unmatched business
        const consumedFromCarry = rightCarry;
        const consumedFromBusiness = cappedMatched - rightCarry;
        newRightCarry = 0; // All carry consumed
        newRightMatched = rightMatched + consumedFromBusiness;
      }
    } else {
      newRightCarry = rightCarry;
    }

    // Calculate leftover after matching and add to carry forward
    // leftover = available - matched
    const leftAfterMatch = leftAvailable - cappedMatched;
    const rightAfterMatch = rightAvailable - cappedMatched;

    // The leftover goes to carry forward on the side that has excess
    if (leftAfterMatch > rightAfterMatch) {
      // Left side has leftover, add to leftCarry
      newLeftCarry = newLeftCarry + (leftAfterMatch - rightAfterMatch);
    } else if (rightAfterMatch > leftAfterMatch) {
      // Right side has leftover, add to rightCarry
      newRightCarry = newRightCarry + (rightAfterMatch - leftAfterMatch);
    }

    // Update binary tree
    // IMPORTANT: leftBusiness and rightBusiness remain unchanged (cumulative)
    userTree.leftCarry = Types.Decimal128.fromString(newLeftCarry.toString());
    userTree.rightCarry = Types.Decimal128.fromString(newRightCarry.toString());
    userTree.leftMatched = Types.Decimal128.fromString(newLeftMatched.toString());
    userTree.rightMatched = Types.Decimal128.fromString(newRightMatched.toString());

    await userTree.save();

    return {
      binaryBonus,
      matched: cappedMatched,
      cappedMatched,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to calculate binary bonus", 500);
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use addBusinessVolume and calculateBinaryBonus separately
 */
export async function updateBinaryTreeBusiness(
  userId: Types.ObjectId,
  amount: number,
  position: "left" | "right"
) {
  // Add BV first
  await addBusinessVolume(userId, amount, position);
  
  // Then calculate binary bonus (will use default 10% and $1000 cap)
  // Note: This should ideally get package info for correct binaryPct and powerCapacity
  const result = await calculateBinaryBonus(userId, 10, 1000);
  
  return {
    binaryBonus: result.binaryBonus,
    leftBusiness: 0, // Will be updated by addBusinessVolume
    rightBusiness: 0,
    leftCarry: 0,
    rightCarry: 0,
  };
}

/**
 * Update wallet balance
 * Creates wallet if it doesn't exist
 */
export async function updateWallet(
  userId: Types.ObjectId,
  walletType: WalletType,
  amount: number,
  operation: "add" | "subtract" = "add"
) {
  try {
    let wallet = await Wallet.findOne({ user: userId, type: walletType });
    
    // If wallet doesn't exist, create it
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        type: walletType,
        balance: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }

    const currentBalance = parseFloat(wallet.balance.toString());
    const newBalance = operation === "add" 
      ? currentBalance + amount 
      : currentBalance - amount;

    if (newBalance < 0) {
      throw new AppError("Insufficient wallet balance", 400);
    }

    wallet.balance = Types.Decimal128.fromString(newBalance.toString());
    await wallet.save();

    return wallet;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to update wallet", 500);
  }
}

/**
 * Process investment and update all related tables
 */
export async function processInvestment(
  userId: Types.ObjectId,
  packageId: Types.ObjectId,
  amount: number,
  paymentId?: string
) {
  try {
    // Get user and package
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      throw new AppError("Package not found", 404);
    }

    // Validate amount
    const minAmount = parseFloat(pkg.minAmount.toString());
    const maxAmount = parseFloat(pkg.maxAmount.toString());
    
    if (amount < minAmount || amount > maxAmount) {
      throw new AppError(
        `Investment amount must be between $${minAmount} and $${maxAmount}`,
        400
      );
    }

    // Get user's binary tree to determine position
    let userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree) {
      // Binary tree not found - try to create it using user's referrer and position
      console.warn(`Binary tree not found for user ${userId}, attempting to create it...`);
      try {
        const referrerId = user.referrer ? (user.referrer as Types.ObjectId) : null;
        const position = (user.position as "left" | "right" | null) || null;
        
        // If no referrer, assign to admin
        const finalReferrerId = referrerId || await getAdminUser();
        
        await initializeBinaryTree(userId, finalReferrerId, position || undefined);
        userTree = await BinaryTree.findOne({ user: userId });
        if (!userTree) {
          throw new AppError("Failed to create binary tree for user. Please contact support.", 500);
        }
        console.log(`Binary tree created successfully for user ${userId}`);
      } catch (initError: any) {
        console.error(`Failed to create binary tree for user ${userId}:`, initError);
        throw new AppError(
          `User binary tree not found and could not be created: ${initError.message || 'Unknown error'}. Please contact support.`,
          500
        );
      }
    }

    // Determine position (left or right) based on user's position in parent's tree
    let position: "left" | "right" = "left"; // Default
    if (user.position) {
      position = user.position as "left" | "right";
    }

    // Get package configuration (use new fields, fallback to legacy)
    const durationDays = pkg.duration || 150;
    const totalOutputPct = pkg.totalOutputPct || pkg.roi || 225;
    const renewablePrinciplePct = pkg.renewablePrinciplePct || pkg.principleReturn || 50;
    
    // Calculate daily ROI rate: (totalOutputPct/100) / durationDays
    const dailyRoiRate = (totalOutputPct / 100) / durationDays;
    
    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);
    const expiresOn = endDate; // Legacy field

    // Create investment record (PackageInstance)
    const investment = await Investment.create({
      user: userId,
      sponsor: user.referrer || undefined,
      packageId,
      investedAmount: Types.Decimal128.fromString(amount.toString()),
      principal: Types.Decimal128.fromString(amount.toString()), // Starts equal to investedAmount
      depositAmount: Types.Decimal128.fromString(amount.toString()),
      type: "self",
      isBinaryUpdated: false,
      referralPaid: false,
      voucherId: paymentId,
      startDate,
      endDate,
      durationDays,
      totalOutputPct,
      dailyRoiRate,
      daysElapsed: 0,
      daysRemaining: durationDays,
      expiresOn, // Legacy field
      lastRoiDate: null, // Will be set on first ROI calculation
      totalRoiEarned: Types.Decimal128.fromString("0"),
      totalReinvested: Types.Decimal128.fromString("0"),
      isActive: true,
    });

    // Add investment amount to user's investment wallet
    await updateWallet(userId, WalletType.INVESTMENT, amount, "add");
    
    // Create investment transaction
    await createInvestmentTransaction(
      userId,
      amount,
      investment._id.toString()
    );

    // Process referral bonus for direct sponsor (level 1) - one-time at activation
    if (user.referrer && !investment.referralPaid) {
      await processReferralBonus(user.referrer, amount, pkg, investment._id.toString());
      investment.referralPaid = true;
      await investment.save();
    }

    // Process binary bonuses up the tree
    // This will add BV to parent's business and calculate bonuses
    await processBinaryBonusesUpTree(
      userId, 
      amount, 
      position, 
      pkg, 
      investment._id.toString()
    );

    // Mark investment as binary updated
    investment.isBinaryUpdated = true;
    await investment.save();

    return investment;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to process investment", 500);
  }
}

/**
 * Process binary bonuses up the tree
 * This function traverses up the binary tree and distributes binary bonuses
 * When a user invests, we add BV to their parent's leg and calculate bonuses using consumption model
 */
async function processBinaryBonusesUpTree(
  userId: Types.ObjectId,
  amount: number,
  position: "left" | "right",
  pkg: any,
  investmentId?: string
) {
  try {
    // Get package configuration for binary calculation
    const binaryPct = pkg.binaryPct || pkg.binaryBonus || 10;
    const powerCapacity = parseFloat(pkg.powerCapacity?.toString() || pkg.cappingLimit?.toString() || "1000");

    let currentUserId = userId;

    // Traverse up the tree starting from the investing user
    while (currentUserId) {
      const currentTree = await BinaryTree.findOne({ user: currentUserId });
      if (!currentTree || !currentTree.parent) {
        break; // Reached root or no parent
      }

      const parentTree = await BinaryTree.findOne({ user: currentTree.parent });
      if (!parentTree) {
        break;
      }

      // Determine which side of parent this user is on
      const isLeftChild = parentTree.leftChild?.toString() === currentUserId.toString();
      const isRightChild = parentTree.rightChild?.toString() === currentUserId.toString();
      
      // Check if user is a direct child (binary tree) or admin's child (unlimited)
      if (isLeftChild || isRightChild) {
        // User is a direct binary child
        const parentPosition = isLeftChild ? "left" : "right";
        
        // Add BV to parent's leg (Business Volume)
        await addBusinessVolume(
          currentTree.parent,
          amount,
          parentPosition
        );

        // Calculate binary bonus using consumption model
        const binaryResult = await calculateBinaryBonus(
          currentTree.parent,
          binaryPct,
          powerCapacity
        );

        // Add binary bonus to parent's binary wallet
        if (binaryResult.binaryBonus > 0) {
          await updateWallet(
            currentTree.parent,
            WalletType.BINARY,
            binaryResult.binaryBonus,
            "add"
          );
          
          // Create binary transaction
          await createBinaryTransaction(
            currentTree.parent,
            binaryResult.binaryBonus,
            currentUserId.toString(),
            investmentId
          );
        }

        // Move up to parent for next iteration
        // Each level calculates its own bonus based on its children's business
        currentUserId = currentTree.parent;
      } else {
        // Check if parent is admin (has unlimited children via parent relationship)
        const parentUser = await User.findById(currentTree.parent);
        if (parentUser?.userId === "CROWN-000000") {
          // User is admin's child, add BV but don't calculate binary bonus
          // Admin doesn't follow binary tree rules for bonuses
          const adminPosition = position; // Use the original position
          await addBusinessVolume(
            currentTree.parent,
            amount,
            adminPosition
          );
          break;
        } else {
          // Not a direct child and not admin's child, stop traversal
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error processing binary bonuses up tree:", error);
    // Don't throw, just log - we don't want to fail the investment if bonus distribution fails
  }
}

/**
 * Process referral bonus for direct sponsor (level 1) - one-time at activation
 * Uses referralPct (default 7%) from package
 */
async function processReferralBonus(
  sponsorId: Types.ObjectId,
  amount: number,
  pkg: any,
  investmentId?: string
) {
  try {
    // Get package referral bonus percentage (use new referralPct, fallback to legacy levelOneReferral)
    const referralPercentage = pkg.referralPct || pkg.levelOneReferral || 7;
    
    // Calculate referral bonus: referral_pct * invested_amount
    const referralBonus = amount * (referralPercentage / 100);
    
    if (referralBonus > 0) {
      // Add referral bonus to sponsor's referral wallet
      await updateWallet(
        sponsorId,
        WalletType.REFERRAL,
        referralBonus,
        "add"
      );
      
      // Create referral transaction
      await createReferralTransaction(
        sponsorId,
        referralBonus,
        undefined, // fromUserId can be passed if needed
        investmentId
      );
    }
  } catch (error) {
    console.error("Error processing referral bonus:", error);
    // Don't throw, just log
  }
}

