/**
 * Simple Script to Create User A with User B (left) and User C (right)
 * 
 * Usage: npm run create:abc-users
 * Or: npx ts-node -r dotenv/config src/scripts/createABCUsers.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import { initializeUser } from "../services/userInit.service";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "mongodb://localhost:27017/binary_system";

async function createABCUsers() {
  try {
    console.log("=".repeat(60));
    console.log("Creating User A, B (left), and C (right)");
    console.log("=".repeat(60));

    // Connect to MongoDB
    console.log(`\nConnecting to MongoDB at: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check if users already exist
    const existingA = await User.findOne({ userId: "USER-A" });
    const existingB = await User.findOne({ userId: "USER-B" });
    const existingC = await User.findOne({ userId: "USER-C" });

    if (existingA || existingB || existingC) {
      console.log("⚠️  Users A, B, or C already exist!");
      console.log("   Existing users:");
      if (existingA) console.log(`   - USER-A: ${existingA.name} (${existingA.email})`);
      if (existingB) console.log(`   - USER-B: ${existingB.name} (${existingB.email})`);
      if (existingC) console.log(`   - USER-C: ${existingC.name} (${existingC.email})`);
      console.log("\n   To recreate, delete these users first or modify the script.");
      await mongoose.disconnect();
      return;
    }

    // Create User A (root)
    console.log("Creating User A...");
    const userA = await User.create({
      userId: "USER-A",
      name: "User A",
      email: "usera@test.com",
      phone: "1111111111",
      password: "hashed", // In production, this should be properly hashed
      referrer: null,
      position: null,
      status: "active",
    });
    console.log(`✅ Created User A: ${userA.userId} (${userA.name})`);

    // Initialize User A's binary tree and wallets
    await initializeUser(userA._id as Types.ObjectId, null, undefined);
    console.log("✅ Initialized User A's binary tree and wallets");

    // Create User B (left child of A)
    console.log("\nCreating User B (left child of A)...");
    const userB = await User.create({
      userId: "USER-B",
      name: "User B",
      email: "userb@test.com",
      phone: "2222222222",
      password: "hashed",
      referrer: userA._id,
      position: "left",
      status: "active",
    });
    console.log(`✅ Created User B: ${userB.userId} (${userB.name})`);

    // Initialize User B's binary tree and wallets
    await initializeUser(userB._id as Types.ObjectId, userA._id as Types.ObjectId, "left");
    console.log("✅ Initialized User B's binary tree and wallets");

    // Create User C (right child of A)
    console.log("\nCreating User C (right child of A)...");
    const userC = await User.create({
      userId: "USER-C",
      name: "User C",
      email: "userc@test.com",
      phone: "3333333333",
      password: "hashed",
      referrer: userA._id,
      position: "right",
      status: "active",
    });
    console.log(`✅ Created User C: ${userC.userId} (${userC.name})`);

    // Initialize User C's binary tree and wallets
    await initializeUser(userC._id as Types.ObjectId, userA._id as Types.ObjectId, "right");
    console.log("✅ Initialized User C's binary tree and wallets");

    // Verify binary tree structure
    console.log("\n" + "=".repeat(60));
    console.log("Verifying Binary Tree Structure");
    console.log("=".repeat(60));

    const treeA = await BinaryTree.findOne({ user: userA._id })
      .populate("leftChild", "userId name")
      .populate("rightChild", "userId name")
      .lean();

    if (treeA) {
      console.log(`\nUser A's Binary Tree:`);
      console.log(`  Left Child: ${(treeA.leftChild as any)?.userId || "None"} (${(treeA.leftChild as any)?.name || "None"})`);
      console.log(`  Right Child: ${(treeA.rightChild as any)?.userId || "None"} (${(treeA.rightChild as any)?.name || "None"})`);
      console.log(`  Left Business: ${parseFloat(treeA.leftBusiness?.toString() || "0")}`);
      console.log(`  Right Business: ${parseFloat(treeA.rightBusiness?.toString() || "0")}`);
      console.log(`  Left Downlines: ${treeA.leftDownlines || 0}`);
      console.log(`  Right Downlines: ${treeA.rightDownlines || 0}`);
    }

    const treeB = await BinaryTree.findOne({ user: userB._id })
      .populate("parent", "userId name")
      .lean();

    if (treeB) {
      console.log(`\nUser B's Binary Tree:`);
      console.log(`  Parent: ${(treeB.parent as any)?.userId || "None"} (${(treeB.parent as any)?.name || "None"})`);
      console.log(`  Position: left`);
    }

    const treeC = await BinaryTree.findOne({ user: userC._id })
      .populate("parent", "userId name")
      .lean();

    if (treeC) {
      console.log(`\nUser C's Binary Tree:`);
      console.log(`  Parent: ${(treeC.parent as any)?.userId || "None"} (${(treeC.parent as any)?.name || "None"})`);
      console.log(`  Position: right`);
    }

    // Verify wallets
    console.log("\n" + "=".repeat(60));
    console.log("Verifying Wallets");
    console.log("=".repeat(60));

    const walletsA = await Wallet.find({ user: userA._id }).lean();
    const walletsB = await Wallet.find({ user: userB._id }).lean();
    const walletsC = await Wallet.find({ user: userC._id }).lean();

    console.log(`\nUser A has ${walletsA.length} wallet(s):`);
    walletsA.forEach((w: any) => {
      console.log(`  - ${w.type}: $${parseFloat(w.balance?.toString() || "0")}`);
    });

    console.log(`\nUser B has ${walletsB.length} wallet(s):`);
    walletsB.forEach((w: any) => {
      console.log(`  - ${w.type}: $${parseFloat(w.balance?.toString() || "0")}`);
    });

    console.log(`\nUser C has ${walletsC.length} wallet(s):`);
    walletsC.forEach((w: any) => {
      console.log(`  - ${w.type}: $${parseFloat(w.balance?.toString() || "0")}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ Successfully created User A, B, and C!");
    console.log("=".repeat(60));
    console.log("\nUser Details:");
    console.log(`  User A: ${userA.userId} - ${userA.name} (${userA.email})`);
    console.log(`  User B: ${userB.userId} - ${userB.name} (${userB.email}) [LEFT of A]`);
    console.log(`  User C: ${userC.userId} - ${userC.name} (${userC.email}) [RIGHT of A]`);

  } catch (error: any) {
    console.error("\n❌ Error creating users:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the script
createABCUsers();

