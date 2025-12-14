/**
 * Migration Script: Move Career Rewards from ROI Wallet to Career Level Wallet
 * 
 * This script identifies career reward transactions that were incorrectly
 * credited to ROI wallets and moves them to Career Level wallets.
 * 
 * IMPORTANT: This should be run AFTER:
 * 1. Career Level wallets are created (addCareerLevelWallets.ts)
 * 2. New code is deployed that prevents future career rewards going to ROI wallet
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import connectdb from "../db/index";

dotenv.config();

interface MigrationResult {
  userId: string;
  transactionsMoved: number;
  totalAmountMoved: number;
  success: boolean;
  error?: string;
}

async function migrateCareerRewardsFromROI() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("MIGRATING CAREER REWARDS FROM ROI WALLET TO CAREER LEVEL WALLET");
    console.log("=".repeat(80) + "\n");

    await connectdb();
    console.log("✅ Connected to database\n");

    // Find all ROI wallets that have career reward transactions
    const roiWallets = await Wallet.find({ type: WalletType.ROI }).lean();
    console.log(`📊 Found ${roiWallets.length} ROI wallets to check\n`);

    const results: MigrationResult[] = [];
    let totalTransactionsMoved = 0;
    let totalAmountMoved = 0;

    for (const roiWallet of roiWallets) {
      try {
        // Find career reward transactions in this ROI wallet
        const careerRewardTransactions = await WalletTransaction.find({
          wallet: roiWallet._id,
          "meta.type": "career_reward",
        }).lean();

        if (careerRewardTransactions.length === 0) {
          continue; // No career rewards in this wallet
        }

        const userId = roiWallet.user.toString();
        console.log(`\n👤 Processing user ${userId}`);
        console.log(`   Found ${careerRewardTransactions.length} career reward transaction(s)`);

        // Get or ensure Career Level wallet exists
        let careerLevelWallet = await Wallet.findOne({
          user: roiWallet.user,
          type: WalletType.CAREER_LEVEL,
        });

        if (!careerLevelWallet) {
          console.log(`   ⚠️  Career Level wallet not found, creating...`);
          careerLevelWallet = await Wallet.create({
            user: roiWallet.user,
            type: WalletType.CAREER_LEVEL,
            balance: Types.Decimal128.fromString("0"),
            reserved: Types.Decimal128.fromString("0"),
            currency: "USD",
          });
          console.log(`   ✅ Career Level wallet created`);
        }

        // Calculate total amount to move
        let totalAmount = 0;
        for (const tx of careerRewardTransactions) {
          totalAmount += parseFloat(tx.amount.toString());
        }

        console.log(`   💰 Total amount to move: $${totalAmount.toFixed(2)}`);

        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // 1. Move balance from ROI wallet to Career Level wallet
          const currentRoiBalance = parseFloat(roiWallet.balance.toString());
          const currentCareerBalance = parseFloat(careerLevelWallet.balance.toString());

          const newRoiBalance = currentRoiBalance - totalAmount;
          const newCareerBalance = currentCareerBalance + totalAmount;

          if (newRoiBalance < 0) {
            throw new Error(`Insufficient ROI wallet balance. Current: $${currentRoiBalance}, Required: $${totalAmount}`);
          }

          // Update ROI wallet balance
          await Wallet.findByIdAndUpdate(
            roiWallet._id,
            { balance: Types.Decimal128.fromString(newRoiBalance.toString()) },
            { session }
          );

          // Update Career Level wallet balance
          await Wallet.findByIdAndUpdate(
            careerLevelWallet._id,
            { balance: Types.Decimal128.fromString(newCareerBalance.toString()) },
            { session }
          );

          // 2. Update transaction wallet references
          // Update each transaction to point to Career Level wallet instead of ROI wallet
          for (const tx of careerRewardTransactions) {
            await WalletTransaction.findByIdAndUpdate(
              tx._id,
              { wallet: careerLevelWallet._id },
              { session }
            );
          }

          // 3. Create new credit transaction in Career Level wallet for balance adjustment
          // (This ensures the transaction history shows the migration)
          await WalletTransaction.create([{
            user: roiWallet.user,
            wallet: careerLevelWallet._id,
            type: "credit",
            amount: Types.Decimal128.fromString(totalAmount.toString()),
            currency: "USD",
            balanceBefore: Types.Decimal128.fromString(currentCareerBalance.toString()),
            balanceAfter: Types.Decimal128.fromString(newCareerBalance.toString()),
            status: "completed",
            meta: {
              type: "career_reward_migration",
              source: "roi_wallet",
              originalTransactions: careerRewardTransactions.map((tx) => tx._id.toString()),
              migrationDate: new Date().toISOString(),
            },
          }], { session });

          await session.commitTransaction();
          session.endSession();

          console.log(`   ✅ Successfully migrated $${totalAmount.toFixed(2)}`);
          console.log(`   📊 ROI wallet: $${currentRoiBalance.toFixed(2)} → $${newRoiBalance.toFixed(2)}`);
          console.log(`   📊 Career Level wallet: $${currentCareerBalance.toFixed(2)} → $${newCareerBalance.toFixed(2)}`);

          results.push({
            userId,
            transactionsMoved: careerRewardTransactions.length,
            totalAmountMoved: totalAmount,
            success: true,
          });

          totalTransactionsMoved += careerRewardTransactions.length;
          totalAmountMoved += totalAmount;
        } catch (error: any) {
          await session.abortTransaction();
          session.endSession();
          throw error;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing user ${roiWallet.user}: ${error.message}`);
        results.push({
          userId: roiWallet.user.toString(),
          transactionsMoved: 0,
          totalAmountMoved: 0,
          success: false,
          error: error.message,
        });
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("MIGRATION SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Users Processed: ${results.length}`);
    console.log(`✅ Successful: ${results.filter((r) => r.success).length}`);
    console.log(`❌ Failed: ${results.filter((r) => !r.success).length}`);
    console.log(`Total Transactions Moved: ${totalTransactionsMoved}`);
    console.log(`Total Amount Migrated: $${totalAmountMoved.toFixed(2)}`);
    console.log("=".repeat(80) + "\n");

    // Show failed migrations
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      console.log("Failed Migrations:");
      failed.forEach((r) => {
        console.log(`  - User ${r.userId}: ${r.error}`);
      });
      console.log();
    }

    await mongoose.connection.close();
    process.exit(failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  migrateCareerRewardsFromROI();
}

export { migrateCareerRewardsFromROI };
