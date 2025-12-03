import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import connectdb from "../db/index";

// Load environment variables
dotenv.config({ path: "./.env" });

/**
 * Migration script to add investment wallets to all existing users
 * This ensures all users have the investment wallet type
 */
async function addInvestmentWallets() {
  try {
    console.log("🔄 Starting migration: Adding investment wallets to existing users...");

    // Connect to database
    await connectdb();
    console.log("✅ Database connected");

    // Get all users
    const users = await User.find({}).lean();
    console.log(`📊 Found ${users.length} users`);

    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if investment wallet already exists
        const existingWallet = await Wallet.findOne({
          user: user._id,
          type: WalletType.INVESTMENT,
        });

        if (existingWallet) {
          existingCount++;
          continue;
        }

        // Create investment wallet
        await Wallet.create({
          user: user._id,
          type: WalletType.INVESTMENT,
          balance: "0",
          reserved: "0",
          currency: "USD",
        });

        createdCount++;
      } catch (error: any) {
        console.error(`❌ Error creating wallet for user ${user._id}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`   ✅ Created: ${createdCount} investment wallets`);
    console.log(`   ℹ️  Already existed: ${existingCount} wallets`);
    console.log(`   ❌ Errors: ${errorCount}`);

    console.log("\n✨ Migration completed successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  addInvestmentWallets();
}

export { addInvestmentWallets };

