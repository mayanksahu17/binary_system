/**
 * Diagnose Carry Forward Issue
 * 
 * Analyzes the carry forward calculation for a specific scenario
 * Left Business: $5000, Right Business: $6000
 * Expected: Right Carry = $1000, Left Carry = $0
 * 
 * Usage: npx ts-node -r dotenv/config src/scripts/diagnoseCarryForward.ts [userId]
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { BinaryTree } from "../models/BinaryTree";
import { User } from "../models/User";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI;

async function diagnose(userId?: string) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    let user;
    if (userId) {
      user = await User.findOne({ userId });
      if (!user) {
        console.log(`❌ User ${userId} not found`);
        await mongoose.disconnect();
        return;
      }
    } else {
      // Find a user with approximately $5000 left and $6000 right
      const trees = await BinaryTree.find({})
        .populate('user', 'userId name email')
        .lean();
      
      const matchingTrees = trees.filter(tree => {
        const left = parseFloat((tree.leftBusiness as any).toString());
        const right = parseFloat((tree.rightBusiness as any).toString());
        // Find trees with left around 5000 and right around 6000
        return Math.abs(left - 5000) < 500 && Math.abs(right - 6000) < 500;
      });

      if (matchingTrees.length === 0) {
        console.log("No users found with left~$5000 and right~$6000 business");
        console.log("Please provide a userId as argument\n");
        await mongoose.disconnect();
        return;
      }

      const tree = matchingTrees[0];
      user = await User.findById((tree.user as any)._id);
      console.log(`Found user: ${(user as any).userId} (${(user as any).name})\n`);
    }

    const tree = await BinaryTree.findOne({ user: user!._id });
    if (!tree) {
      console.log("❌ Binary tree not found");
      await mongoose.disconnect();
      return;
    }

    const leftBusiness = parseFloat(tree.leftBusiness.toString());
    const rightBusiness = parseFloat(tree.rightBusiness.toString());
    const leftCarry = parseFloat(tree.leftCarry.toString());
    const rightCarry = parseFloat(tree.rightCarry.toString());
    const leftMatched = parseFloat(tree.leftMatched?.toString() || "0");
    const rightMatched = parseFloat(tree.rightMatched?.toString() || "0");

    console.log("=".repeat(80));
    console.log("CARRY FORWARD DIAGNOSIS");
    console.log("=".repeat(80));
    console.log(`User: ${(user as any).userId} - ${(user as any).name || (user as any).email}`);
    console.log();

    console.log("Current State:");
    console.log(`  Left Business (Cumulative): $${leftBusiness.toFixed(2)}`);
    console.log(`  Right Business (Cumulative): $${rightBusiness.toFixed(2)}`);
    console.log(`  Left Matched (Previously Matched): $${leftMatched.toFixed(2)}`);
    console.log(`  Right Matched (Previously Matched): $${rightMatched.toFixed(2)}`);
    console.log(`  Left Carry (Current): $${leftCarry.toFixed(2)}`);
    console.log(`  Right Carry (Current): $${rightCarry.toFixed(2)}`);
    console.log();

    // Calculate what should happen
    const leftUnmatched = leftBusiness - leftMatched;
    const rightUnmatched = rightBusiness - rightMatched;
    const leftAvailable = leftCarry + leftUnmatched;
    const rightAvailable = rightCarry + rightUnmatched;
    const matched = Math.min(leftAvailable, rightAvailable);

    console.log("Calculation Breakdown:");
    console.log(`  Left Unmatched Business: $${leftUnmatched.toFixed(2)} (Business - Matched)`);
    console.log(`  Right Unmatched Business: $${rightUnmatched.toFixed(2)} (Business - Matched)`);
    console.log(`  Left Available: $${leftAvailable.toFixed(2)} (Carry + Unmatched)`);
    console.log(`  Right Available: $${rightAvailable.toFixed(2)} (Carry + Unmatched)`);
    console.log(`  Matched Amount: $${matched.toFixed(2)} (min of both)`);
    console.log();

    // Expected carry forward (simple: leftover after matching)
    const expectedRightCarry = Math.max(0, rightAvailable - matched);
    const expectedLeftCarry = Math.max(0, leftAvailable - matched);

    console.log("Expected Carry Forward (After Next Calculation):");
    console.log(`  Left Carry: $${expectedLeftCarry.toFixed(2)}`);
    console.log(`  Right Carry: $${expectedRightCarry.toFixed(2)}`);
    console.log();

    // Check if this matches user's scenario
    if (Math.abs(leftBusiness - 5000) < 100 && Math.abs(rightBusiness - 6000) < 100) {
      console.log("=".repeat(80));
      console.log("USER'S SCENARIO CHECK: Left=$5000, Right=$6000");
      console.log("=".repeat(80));
      console.log(`Expected: Right Carry = $1000, Left Carry = $0`);
      console.log(`Current:  Right Carry = $${rightCarry.toFixed(2)}, Left Carry = $${leftCarry.toFixed(2)}`);
      console.log(`After Calc: Right Carry = $${expectedRightCarry.toFixed(2)}, Left Carry = $${expectedLeftCarry.toFixed(2)}`);
      console.log();

      if (Math.abs(leftCarry) < 0.01 && Math.abs(rightCarry - 1000) < 0.01) {
        console.log("✅ Current carry forward is CORRECT for this scenario");
      } else if (Math.abs(expectedRightCarry - 1000) < 0.01 && Math.abs(expectedLeftCarry) < 0.01) {
        console.log("⚠️  Current carry forward is incorrect, but NEXT calculation will fix it");
        console.log("   (Run binary bonus calculation to update carry forward)");
      } else {
        console.log("❌ Carry forward calculation appears incorrect");
        console.log("   This may indicate a bug in the calculation logic");
      }
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect();
  }
}

const userId = process.argv[2];
diagnose(userId);
