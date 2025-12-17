/**
 * Simple Test: Carry Forward Calculation
 * 
 * Tests the specific scenario: Left $5000, Right $6000
 * Expected: Only $1000 carry forward on right side
 * 
 * Usage: npx ts-node -r dotenv/config src/scripts/testCarryForwardSimple.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { BinaryTree } from "../models/BinaryTree";
import { calculateDailyBinaryBonuses } from "../services/investment.service";
import { User } from "../models/User";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI;

async function testCarryForwardScenario() {
  console.log("\n" + "=".repeat(60));
  console.log("CARRY FORWARD SIMPLE TEST");
  console.log("=".repeat(60));
  console.log("\nScenario: Left Business $5000, Right Business $6000");
  console.log("Expected: Right Carry Forward = $1000, Left Carry Forward = $0\n");

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find a test user or use CROWN-000018 as mentioned by user
    const testUserId = "CROWN-000018";
    const user = await User.findOne({ userId: testUserId });
    
    if (!user) {
      console.log(`❌ User ${testUserId} not found. Creating test scenario...`);
      console.log("Please ensure you have a user with leftBusiness=$5000 and rightBusiness=$6000");
      await mongoose.disconnect();
      return;
    }

    const tree = await BinaryTree.findOne({ user: user._id });
    if (!tree) {
      console.log(`❌ Binary tree not found for user ${testUserId}`);
      await mongoose.disconnect();
      return;
    }

    const leftBusiness = parseFloat(tree.leftBusiness.toString());
    const rightBusiness = parseFloat(tree.rightBusiness.toString());
    const leftCarry = parseFloat(tree.leftCarry.toString());
    const rightCarry = parseFloat(tree.rightCarry.toString());
    const leftMatched = parseFloat(tree.leftMatched?.toString() || "0");
    const rightMatched = parseFloat(tree.rightMatched?.toString() || "0");

    console.log("Current State:");
    console.log(`  Left Business: $${leftBusiness.toFixed(2)}`);
    console.log(`  Right Business: $${rightBusiness.toFixed(2)}`);
    console.log(`  Left Matched: $${leftMatched.toFixed(2)}`);
    console.log(`  Right Matched: $${rightMatched.toFixed(2)}`);
    console.log(`  Left Carry: $${leftCarry.toFixed(2)}`);
    console.log(`  Right Carry: $${rightCarry.toFixed(2)}\n`);

    // Calculate expected carry forward
    const leftUnmatched = leftBusiness - leftMatched;
    const rightUnmatched = rightBusiness - rightMatched;
    const leftAvailable = leftCarry + leftUnmatched;
    const rightAvailable = rightCarry + rightUnmatched;
    const matched = Math.min(leftAvailable, rightAvailable);
    
    console.log("Calculation:");
    console.log(`  Left Unmatched Business: $${leftUnmatched.toFixed(2)}`);
    console.log(`  Right Unmatched Business: $${rightUnmatched.toFixed(2)}`);
    console.log(`  Left Available: $${leftAvailable.toFixed(2)} (carry + unmatched)`);
    console.log(`  Right Available: $${rightAvailable.toFixed(2)} (carry + unmatched)`);
    console.log(`  Matched Amount: $${matched.toFixed(2)} (min of both)\n`);

    // Expected carry forward (simplified: just the excess)
    const expectedRightCarry = Math.max(0, rightAvailable - matched);
    const expectedLeftCarry = Math.max(0, leftAvailable - matched);

    console.log("Expected After Matching:");
    console.log(`  Left Carry: $${expectedLeftCarry.toFixed(2)}`);
    console.log(`  Right Carry: $${expectedRightCarry.toFixed(2)}\n`);

    // Run binary bonus calculation
    console.log("Running binary bonus calculation...");
    await calculateDailyBinaryBonuses();
    console.log("✅ Binary bonus calculation completed\n");

    // Check results
    const updatedTree = await BinaryTree.findOne({ user: user._id });
    if (!updatedTree) {
      console.log("❌ Failed to retrieve updated tree");
      await mongoose.disconnect();
      return;
    }

    const actualLeftCarry = parseFloat(updatedTree.leftCarry.toString());
    const actualRightCarry = parseFloat(updatedTree.rightCarry.toString());

    console.log("Actual Results After Calculation:");
    console.log(`  Left Carry: $${actualLeftCarry.toFixed(2)}`);
    console.log(`  Right Carry: $${actualRightCarry.toFixed(2)}\n`);

    // For the user's specific case: Left $5000, Right $6000
    // Expected: Right carry = $1000, Left carry = $0
    if (Math.abs(leftBusiness - 5000) < 0.01 && Math.abs(rightBusiness - 6000) < 0.01) {
      const expectedRight = 1000;
      const expectedLeft = 0;
      
      console.log("=".repeat(60));
      console.log("TEST RESULTS (For $5000 left, $6000 right scenario)");
      console.log("=".repeat(60));
      console.log(`Expected Right Carry: $${expectedRight.toFixed(2)}`);
      console.log(`Actual Right Carry: $${actualRightCarry.toFixed(2)}`);
      console.log(`Expected Left Carry: $${expectedLeft.toFixed(2)}`);
      console.log(`Actual Left Carry: $${actualLeftCarry.toFixed(2)}\n`);

      const rightPass = Math.abs(actualRightCarry - expectedRight) < 0.01;
      const leftPass = Math.abs(actualLeftCarry - expectedLeft) < 0.01;

      if (rightPass && leftPass) {
        console.log("✅ TEST PASSED: Carry forward is correct!");
      } else {
        console.log("❌ TEST FAILED: Carry forward values don't match expected");
        if (!rightPass) {
          console.log(`   Right carry expected $${expectedRight.toFixed(2)}, got $${actualRightCarry.toFixed(2)}`);
        }
        if (!leftPass) {
          console.log(`   Left carry expected $${expectedLeft.toFixed(2)}, got $${actualLeftCarry.toFixed(2)}`);
        }
      }
    } else {
      console.log("Note: This user doesn't have exactly $5000 left and $6000 right business.");
      console.log("The calculation above shows how carry forward is computed with current values.");
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

testCarryForwardScenario();
