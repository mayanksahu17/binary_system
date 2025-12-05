/**
 * Script to create left and right children for a given referrer ID
 * 
 * Usage: 
 *   npm run create:children CROWN-000000
 *   OR
 *   npx ts-node -r dotenv/config src/scripts/createLeftRightChildren.ts CROWN-000000
 * 
 * This script creates two users:
 * - One as left child of the referrer
 * - One as right child of the referrer
 */

import mongoose from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Wallet } from "../models/Wallet";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";
import connectdb from "../db/index";

/**
 * Create a user as a child of the referrer
 */
async function createChildUser(
  referrerUser: any,
  position: "left" | "right",
  childNumber: number
): Promise<{ userId: string; user: any }> {
  // Generate next available userId
  const userId = await generateNextUserId();
  const name = `Child ${position} ${childNumber}`;
  const email = `child${position}${childNumber}@test.com`;
  const phone = `123456${childNumber.toString().padStart(4, "0")}`;
  const password = "Test1234!";

  // Check if user already exists
  const existingUser = await findUserByUserId(userId);
  if (existingUser) {
    console.log(`⚠️  User ${userId} already exists, skipping...`);
    return { userId, user: existingUser };
  }

  // Check if position is already occupied
  const referrerTree = await BinaryTree.findOne({ user: referrerUser._id });
  if (referrerTree) {
    const referrerIsAdmin = referrerUser.userId === "CROWN-000000";
    
    if (!referrerIsAdmin) {
      // For non-admin, check if position is already occupied
      if (position === "left" && referrerTree.leftChild) {
        const leftChildUser = await User.findById(referrerTree.leftChild);
        throw new Error(`Left position already occupied by ${leftChildUser?.userId || referrerTree.leftChild}`);
      }
      if (position === "right" && referrerTree.rightChild) {
        const rightChildUser = await User.findById(referrerTree.rightChild);
        throw new Error(`Right position already occupied by ${rightChildUser?.userId || referrerTree.rightChild}`);
      }
    }
  }

  // Create user
  console.log(`📝 Creating user ${userId} as ${position} child of ${referrerUser.userId}...`);
  const user = await User.create({
    userId,
    name,
    email,
    phone,
    password,
    referrer: referrerUser._id as any,
    position: position,
    status: "active",
  });

  // Initialize binary tree and wallets
  try {
    const initResult = await initializeUser(user._id as any, referrerUser._id as any, position);
    console.log(`✅ User ${userId} created successfully as ${position} child`);
    return { userId, user };
  } catch (error: any) {
    // If initialization fails, delete the user
    await User.findByIdAndDelete(user._id);
    await BinaryTree.findOneAndDelete({ user: user._id });
    await Wallet.deleteMany({ user: user._id });
    throw error;
  }
}

/**
 * Main function to create left and right children
 */
async function createLeftRightChildren(referrerId: string) {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await connectdb();
    console.log("✅ Connected to MongoDB\n");

    // Find referrer user
    console.log(`🔍 Looking for referrer: ${referrerId}...`);
    const referrerUser = await findUserByUserId(referrerId);
    
    if (!referrerUser) {
      throw new Error(`Referrer user ${referrerId} not found`);
    }
    
    console.log(`✅ Found referrer: ${referrerUser.name} (${referrerUser.userId})\n`);

    // Check current binary tree state
    const referrerTree = await BinaryTree.findOne({ user: referrerUser._id });
    if (referrerTree) {
      console.log("📊 Current binary tree state:");
      if (referrerTree.leftChild) {
        const leftChild = await User.findById(referrerTree.leftChild);
        console.log(`   - Left child: ${leftChild?.userId || referrerTree.leftChild}`);
      } else {
        console.log(`   - Left child: Available`);
      }
      if (referrerTree.rightChild) {
        const rightChild = await User.findById(referrerTree.rightChild);
        console.log(`   - Right child: ${rightChild?.userId || referrerTree.rightChild}`);
      } else {
        console.log(`   - Right child: Available`);
      }
      console.log();
    }

    // Create left child
    let leftChildResult = null;
    try {
      leftChildResult = await createChildUser(referrerUser, "left", 1);
    } catch (error: any) {
      console.error(`❌ Failed to create left child: ${error.message}`);
    }

    // Create right child
    let rightChildResult = null;
    try {
      rightChildResult = await createChildUser(referrerUser, "right", 2);
    } catch (error: any) {
      console.error(`❌ Failed to create right child: ${error.message}`);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 SUMMARY");
    console.log("=".repeat(60));
    
    if (leftChildResult) {
      console.log(`✅ Left child created: ${leftChildResult.userId} (${leftChildResult.user.name})`);
    } else {
      console.log(`❌ Left child creation failed or skipped`);
    }
    
    if (rightChildResult) {
      console.log(`✅ Right child created: ${rightChildResult.userId} (${rightChildResult.user.name})`);
    } else {
      console.log(`❌ Right child creation failed or skipped`);
    }

    // Verify final state
    const finalTree = await BinaryTree.findOne({ user: referrerUser._id });
    if (finalTree) {
      console.log("\n📊 Final binary tree state:");
      if (finalTree.leftChild) {
        const leftChild = await User.findById(finalTree.leftChild);
        console.log(`   - Left child: ${leftChild?.userId || finalTree.leftChild}`);
      } else {
        console.log(`   - Left child: None`);
      }
      if (finalTree.rightChild) {
        const rightChild = await User.findById(finalTree.rightChild);
        console.log(`   - Right child: ${rightChild?.userId || finalTree.rightChild}`);
      } else {
        console.log(`   - Right child: None`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Script completed successfully");
    console.log("=".repeat(60) + "\n");

  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

// Get referrer ID from command line arguments or prompt
const referrerId = process.argv[2];

if (!referrerId) {
  console.log("Usage: npx ts-node src/scripts/createLeftRightChildren.ts <REFERRER_ID>");
  console.log("Example: npx ts-node src/scripts/createLeftRightChildren.ts CROWN-000000");
  process.exit(1);
}

// Run the script
createLeftRightChildren(referrerId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });

export { createLeftRightChildren };

