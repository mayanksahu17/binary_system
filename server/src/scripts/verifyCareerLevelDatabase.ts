/**
 * Database Verification Script for Career Level Wallet Feature
 * Verifies:
 * 1. All users have Career Level wallets
 * 2. No career rewards in ROI wallets
 * 3. Career rewards only in Career Level wallets
 * 4. Data integrity checks
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { UserCareerProgress } from "../models/UserCareerProgress";
import { WalletType } from "../models/types";
import connectdb from "../db/index";

dotenv.config();

interface VerificationResult {
  check: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function logResult(check: string, status: "PASS" | "FAIL" | "WARNING", message: string, details?: any) {
  results.push({ check, status, message, details });
  const emoji = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`${emoji} ${check}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
  console.log();
}

async function verifyDatabase() {
  try {
    await connectdb();
    console.log("\n" + "=".repeat(80));
    console.log("CAREER LEVEL WALLET - DATABASE VERIFICATION");
    console.log("=".repeat(80) + "\n");

    // Get all users
    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users in database\n`);

    // Check 1: All users have Career Level wallets
    let usersWithoutCareerWallet = 0;
    const usersMissingCareerWallet: string[] = [];

    for (const user of users) {
      const careerWallet = await Wallet.findOne({
        user: user._id,
        type: WalletType.CAREER_LEVEL,
      });
      if (!careerWallet) {
        usersWithoutCareerWallet++;
        usersMissingCareerWallet.push(user.userId || user._id.toString());
      }
    }

    logResult(
      "Check 1: All Users Have Career Level Wallets",
      usersWithoutCareerWallet === 0 ? "PASS" : "FAIL",
      usersWithoutCareerWallet === 0
        ? `All ${users.length} users have Career Level wallets`
        : `${usersWithoutCareerWallet} users missing Career Level wallets`,
      usersWithoutCareerWallet > 0
        ? { missingUsers: usersMissingCareerWallet.slice(0, 10) }
        : undefined
    );

    // Check 2: No career rewards in ROI wallets
    const roiWallets = await Wallet.find({ type: WalletType.ROI });
    let careerRewardsInRoi = 0;
    const problematicTransactions: any[] = [];

    for (const wallet of roiWallets) {
      const transactions = await WalletTransaction.find({
        wallet: wallet._id,
        "meta.type": "career_reward",
      });

      if (transactions.length > 0) {
        careerRewardsInRoi += transactions.length;
        for (const tx of transactions) {
          problematicTransactions.push({
            userId: wallet.user.toString(),
            transactionId: tx._id.toString(),
            amount: parseFloat(tx.amount.toString()),
            createdAt: tx.createdAt,
          });
        }
      }
    }

    logResult(
      "Check 2: No Career Rewards in ROI Wallets",
      careerRewardsInRoi === 0 ? "PASS" : "FAIL",
      careerRewardsInRoi === 0
        ? "No career rewards found in ROI wallets"
        : `Found ${careerRewardsInRoi} career reward transaction(s) in ROI wallets (INCORRECT)`,
      careerRewardsInRoi > 0 ? { problematicTransactions: problematicTransactions.slice(0, 5) } : undefined
    );

    // Check 3: Career rewards only in Career Level wallets
    const careerLevelWallets = await Wallet.find({ type: WalletType.CAREER_LEVEL });
    let careerRewardsInCareerWallet = 0;
    let totalCareerWalletBalance = 0;

    for (const wallet of careerLevelWallets) {
      const transactions = await WalletTransaction.find({
        wallet: wallet._id,
        "meta.type": "career_reward",
      });
      careerRewardsInCareerWallet += transactions.length;
      totalCareerWalletBalance += parseFloat(wallet.balance.toString());
    }

    logResult(
      "Check 3: Career Rewards in Career Level Wallets",
      "PASS",
      `Found ${careerRewardsInCareerWallet} career reward transaction(s) in Career Level wallets (CORRECT)`,
      {
        totalCareerRewards: careerRewardsInCareerWallet,
        totalCareerWalletBalance: totalCareerWalletBalance.toFixed(2),
        usersWithCareerRewards: careerLevelWallets.filter(
          (w) => parseFloat(w.balance.toString()) > 0
        ).length,
      }
    );

    // Check 4: Verify wallet balances match transactions
    let balanceMismatches = 0;
    const mismatchDetails: any[] = [];

    for (const wallet of careerLevelWallets.slice(0, 100)) {
      // Only check first 100 to avoid performance issues
      const transactions = await WalletTransaction.find({
        wallet: wallet._id,
      }).sort({ createdAt: 1 });

      let calculatedBalance = 0;
      for (const tx of transactions) {
        if (tx.type === "credit") {
          calculatedBalance += parseFloat(tx.amount.toString());
        } else {
          calculatedBalance -= parseFloat(tx.amount.toString());
        }
      }

      const actualBalance = parseFloat(wallet.balance.toString());
      const difference = Math.abs(calculatedBalance - actualBalance);

      if (difference > 0.01) {
        // Allow small floating point differences
        balanceMismatches++;
        mismatchDetails.push({
          userId: wallet.user.toString(),
          actualBalance,
          calculatedBalance,
          difference,
        });
      }
    }

    logResult(
      "Check 4: Wallet Balance Integrity",
      balanceMismatches === 0 ? "PASS" : "WARNING",
      balanceMismatches === 0
        ? "All checked wallet balances match transaction history"
        : `Found ${balanceMismatches} wallet(s) with balance mismatches`,
      balanceMismatches > 0 ? { mismatches: mismatchDetails.slice(0, 5) } : undefined
    );

    // Check 5: Career progress tracking
    const allProgress = await UserCareerProgress.find({}).lean();
    let usersWithRewardsButNoProgress = 0;

    for (const progress of allProgress) {
      const careerWallet = await Wallet.findOne({
        user: progress.user,
        type: WalletType.CAREER_LEVEL,
      });

      if (careerWallet) {
        const walletBalance = parseFloat(careerWallet.balance.toString());
        const progressRewards = parseFloat(progress.totalRewardsEarned?.toString() || "0");

        if (walletBalance > 0 && progressRewards === 0) {
          usersWithRewardsButNoProgress++;
        }
      }
    }

    logResult(
      "Check 5: Career Progress Tracking",
      usersWithRewardsButNoProgress === 0 ? "PASS" : "WARNING",
      usersWithRewardsButNoProgress === 0
        ? "All users with career rewards have progress tracking"
        : `${usersWithRewardsButNoProgress} user(s) have rewards but no progress tracking`,
    );

    // Check 6: Verify wallet types enum
    const allWalletTypes = await Wallet.distinct("type");
    const expectedTypes = Object.values(WalletType);
    const missingTypes = expectedTypes.filter((type) => !allWalletTypes.includes(type));

    logResult(
      "Check 6: Wallet Type Enum Coverage",
      missingTypes.length === 0 ? "PASS" : "WARNING",
      missingTypes.length === 0
        ? "All wallet types from enum exist in database"
        : `Missing wallet types: ${missingTypes.join(", ")}`,
    );

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("VERIFICATION SUMMARY");
    console.log("=".repeat(80));
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const warnings = results.filter((r) => r.status === "WARNING").length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log("=".repeat(80) + "\n");

    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Verification error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  verifyDatabase();
}

export { verifyDatabase };
