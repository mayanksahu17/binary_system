/**
 * Test Script: Binary Bonus and Carry Forward Bug Fix
 * 
 * Tests the specific scenario:
 * - User A refers B (left) and C (right)
 * - B invests $6000
 * - C invests $5000
 * 
 * Expected:
 * - Binary Bonus: $500 (10% of $5000 minimum)
 * - Left Carry: $1000 (excess: $6000 - $5000)
 * - Right Carry: $0 (no excess)
 * 
 * Usage: npx ts-node -r dotenv/config src/scripts/testBinaryCarryForwardBug.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Investment } from "../models/Investment";
import { Package } from "../models/Package";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import {
  processInvestment,
  calculateDailyBinaryBonuses,
} from "../services/investment.service";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI;
const PARENT_USER_ID = "CROWN-000020";
const PARENT_PASSWORD = "Test@123";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  expected?: any;
  actual?: any;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, expected?: any, actual?: any) {
  testResults.push({ name, passed, message, expected, actual });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${name}`);
  console.log(`   ${message}`);
  if (expected !== undefined && actual !== undefined) {
    console.log(`   Expected: ${expected}, Actual: ${actual}`);
  }
  console.log();
}

async function setupTestUsers() {
  console.log("Setting up test users...");

  // Find parent user
  const parentUser = await findUserByUserId(PARENT_USER_ID);
  if (!parentUser) {
    throw new Error(`Parent user ${PARENT_USER_ID} not found. Please create this user first.`);
  }

  // Reset parent user's binary tree and wallet for clean test
  const parentTree = await BinaryTree.findOne({ user: parentUser._id });
  if (parentTree) {
    parentTree.leftBusiness = Types.Decimal128.fromString("0");
    parentTree.rightBusiness = Types.Decimal128.fromString("0");
    parentTree.leftCarry = Types.Decimal128.fromString("0");
    parentTree.rightCarry = Types.Decimal128.fromString("0");
    parentTree.leftMatched = Types.Decimal128.fromString("0");
    parentTree.rightMatched = Types.Decimal128.fromString("0");
    await parentTree.save();
  }
  
  // Reset parent user's binary wallet balance
  const parentBinaryWallet = await Wallet.findOne({ 
    user: parentUser._id, 
    type: WalletType.BINARY 
  });
  if (parentBinaryWallet) {
    parentBinaryWallet.balance = Types.Decimal128.fromString("0");
    await parentBinaryWallet.save();
  }
  console.log("✅ Reset parent user's binary tree and wallet to start fresh\n");

  // Clean up existing test users
  const existingTestUsers = await User.find({ userId: { $regex: /^TEST-BINARY-/ } });
  if (existingTestUsers.length > 0) {
    const testUserIds = existingTestUsers.map(u => u._id);
    await BinaryTree.deleteMany({ user: { $in: testUserIds } });
    await Investment.deleteMany({ user: { $in: testUserIds } });
    await Wallet.deleteMany({ user: { $in: testUserIds } });
    await User.deleteMany({ _id: { $in: testUserIds } });
  }

  // Create User B (left child)
  const userIdB = await generateNextUserId();
  const userB = await User.create({
    userId: userIdB,
    name: "Test Binary User B",
    email: `test-binary-b-${Date.now()}@test.com`,
    phone: `+123456789${Date.now() % 10000}`,
    password: "Test@123",
    referrer: parentUser._id as Types.ObjectId,
    position: "left",
    status: "active",
  });
  await initializeUser(userB._id as Types.ObjectId, parentUser._id as Types.ObjectId, "left");

  // Create User C (right child)
  const userIdC = await generateNextUserId();
  const userC = await User.create({
    userId: userIdC,
    name: "Test Binary User C",
    email: `test-binary-c-${Date.now()}@test.com`,
    phone: `+123456788${Date.now() % 10000}`,
    password: "Test@123",
    referrer: parentUser._id as Types.ObjectId,
    position: "right",
    status: "active",
  });
  await initializeUser(userC._id as Types.ObjectId, parentUser._id as Types.ObjectId, "right");

  console.log(`✅ Created test users:`);
  console.log(`   User B: ${userB.userId} (left child)`);
  console.log(`   User C: ${userC.userId} (right child)`);
  console.log();

  return { parentUser, userB, userC };
}

async function runTest() {
  try {
    console.log("=".repeat(80));
    console.log("🧪 BINARY BONUS AND CARRY FORWARD BUG FIX TEST");
    console.log("=".repeat(80));
    console.log();

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Setup test users
    const { parentUser, userB, userC } = await setupTestUsers();

    // Get or create a test package with high powerCapacity for testing
    // We need powerCapacity >= $5000 to allow full $5000 match
    let testPackage = await Package.findOne({ 
      status: "Active",
      packageName: "Binary Test Package"
    });
    if (!testPackage) {
      // Create a test package with high powerCapacity
      testPackage = await Package.create({
        packageName: "Binary Test Package",
        minAmount: Types.Decimal128.fromString("100"),
        maxAmount: Types.Decimal128.fromString("10000"),
        duration: 150,
        totalOutputPct: 225,
        renewablePrinciplePct: 50,
        referralPct: 10,
        binaryPct: 10,
        powerCapacity: Types.Decimal128.fromString("10000"), // High capacity for testing
        status: "Active",
      });
    } else {
      // Update existing package to have high powerCapacity for testing
      testPackage.powerCapacity = Types.Decimal128.fromString("10000");
      await testPackage.save();
    }

    // Also update ALL active packages to have high powerCapacity for this test
    // This ensures calculateDailyBinaryBonuses uses a package with high capacity
    await Package.updateMany(
      { status: "Active" },
      { $set: { powerCapacity: Types.Decimal128.fromString("10000") } }
    );
    console.log("✅ Updated all active packages to have powerCapacity=$10000 for testing\n");

    console.log("Test Scenario:");
    console.log(`  Parent: ${parentUser.userId}`);
    console.log(`  User B (left) invests: $6000`);
    console.log(`  User C (right) invests: $5000`);
    console.log();

    // Step 1: User B invests $6000
    console.log("=== STEP 1: User B invests $6000 ===");
    await processInvestment(
      userB._id as Types.ObjectId,
      testPackage._id as Types.ObjectId,
      6000
    );

    const treeAfterB = await BinaryTree.findOne({ user: parentUser._id });
    const leftBusinessAfterB = parseFloat(treeAfterB!.leftBusiness.toString());
    const rightBusinessAfterB = parseFloat(treeAfterB!.rightBusiness.toString());

    console.log(`  Left Business: $${leftBusinessAfterB.toFixed(2)}`);
    console.log(`  Right Business: $${rightBusinessAfterB.toFixed(2)}`);
    console.log();

    logTest(
      "After B Investment - Left Business",
      Math.abs(leftBusinessAfterB - 6000) < 0.01,
      `Left business should be $6000, got $${leftBusinessAfterB.toFixed(2)}`,
      "$6000",
      `$${leftBusinessAfterB.toFixed(2)}`
    );

    // Step 2: User C invests $5000
    console.log("=== STEP 2: User C invests $5000 ===");
    await processInvestment(
      userC._id as Types.ObjectId,
      testPackage._id as Types.ObjectId,
      5000
    );

    const treeAfterC = await BinaryTree.findOne({ user: parentUser._id });
    const leftBusinessAfterC = parseFloat(treeAfterC!.leftBusiness.toString());
    const rightBusinessAfterC = parseFloat(treeAfterC!.rightBusiness.toString());

    console.log(`  Left Business: $${leftBusinessAfterC.toFixed(2)}`);
    console.log(`  Right Business: $${rightBusinessAfterC.toFixed(2)}`);
    console.log();

    logTest(
      "After C Investment - Business Volumes",
      Math.abs(leftBusinessAfterC - 6000) < 0.01 && Math.abs(rightBusinessAfterC - 5000) < 0.01,
      `Left should be $6000 (got $${leftBusinessAfterC.toFixed(2)}), Right should be $5000 (got $${rightBusinessAfterC.toFixed(2)})`,
      "Left=$6000, Right=$5000",
      `Left=$${leftBusinessAfterC.toFixed(2)}, Right=$${rightBusinessAfterC.toFixed(2)}`
    );

    // Step 3: Run binary bonus calculation
    console.log("=== STEP 3: Run Binary Bonus Calculation ===");
    await calculateDailyBinaryBonuses();

    // Step 4: Check results
    console.log("=== STEP 4: Verify Results ===");
    const treeFinal = await BinaryTree.findOne({ user: parentUser._id });
    const binaryWallet = await Wallet.findOne({ 
      user: parentUser._id, 
      type: WalletType.BINARY 
    });

    const leftBusiness = parseFloat(treeFinal!.leftBusiness.toString());
    const rightBusiness = parseFloat(treeFinal!.rightBusiness.toString());
    const leftCarry = parseFloat(treeFinal!.leftCarry.toString());
    const rightCarry = parseFloat(treeFinal!.rightCarry.toString());
    const leftMatched = parseFloat(treeFinal!.leftMatched?.toString() || "0");
    const rightMatched = parseFloat(treeFinal!.rightMatched?.toString() || "0");
    const binaryBonus = binaryWallet ? parseFloat(binaryWallet.balance.toString()) : 0;

    console.log("Final State:");
    console.log(`  Left Business: $${leftBusiness.toFixed(2)}`);
    console.log(`  Right Business: $${rightBusiness.toFixed(2)}`);
    console.log(`  Left Matched: $${leftMatched.toFixed(2)}`);
    console.log(`  Right Matched: $${rightMatched.toFixed(2)}`);
    console.log(`  Left Carry: $${leftCarry.toFixed(2)}`);
    console.log(`  Right Carry: $${rightCarry.toFixed(2)}`);
    console.log(`  Binary Bonus (wallet): $${binaryBonus.toFixed(2)}`);
    console.log();

    // Expected values
    const expectedBinaryBonus = 500; // 10% of $5000 minimum
    const expectedLeftCarry = 1000;  // $6000 - $5000 excess
    const expectedRightCarry = 0;    // No excess on right

    // Test Binary Bonus
    logTest(
      "Binary Bonus Amount",
      Math.abs(binaryBonus - expectedBinaryBonus) < 0.01,
      `Binary bonus should be $${expectedBinaryBonus}, got $${binaryBonus.toFixed(2)}`,
      `$${expectedBinaryBonus}`,
      `$${binaryBonus.toFixed(2)}`
    );

    // Test Left Carry
    logTest(
      "Left Carry Forward",
      Math.abs(leftCarry - expectedLeftCarry) < 0.01,
      `Left carry should be $${expectedLeftCarry}, got $${leftCarry.toFixed(2)}`,
      `$${expectedLeftCarry}`,
      `$${leftCarry.toFixed(2)}`
    );

    // Test Right Carry
    logTest(
      "Right Carry Forward",
      Math.abs(rightCarry - expectedRightCarry) < 0.01,
      `Right carry should be $${expectedRightCarry}, got $${rightCarry.toFixed(2)}`,
      `$${expectedRightCarry}`,
      `$${rightCarry.toFixed(2)}`
    );

    // Summary
    const total = testResults.length;
    const passed = testResults.filter((t) => t.passed).length;
    const failed = testResults.filter((t) => !t.passed).length;

    console.log("=".repeat(80));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
    console.log("=".repeat(80));

    if (failed > 0) {
      console.log("\n❌ FAILED TESTS:");
      testResults
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`  - ${t.name}: ${t.message}`);
        });
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTest();
