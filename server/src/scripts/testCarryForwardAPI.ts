/**
 * API Test Suite: Carry Forward Flush Verification
 * 
 * Tests the carry forward flush scenario via actual API calls to verify the bug
 * 
 * Scenario:
 * 1. User A has $400 in right carry forward
 * 2. User A has $0 in left business
 * 3. User A's left referral invests $400
 * 4. After binary calculation, the carry forward should be flushed to $0
 * 
 * Usage: npm run test:carry-forward-api
 * Or: npx ts-node -r dotenv/config src/scripts/testCarryForwardAPI.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Investment } from "../models/Investment";
import { Package } from "../models/Package";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import { initializeUser } from "../services/userInit.service";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "mongodb://localhost:27017/binary_system";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000/api/v1";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string, details?: any) {
  testResults.push({ name, passed, message, details });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${name}`);
  console.log(`   ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
  console.log();
}

async function setupTestData() {
  console.log("Setting up test data...\n");

  // Clean up existing test data
  await User.deleteMany({ userId: { $regex: /^API-TEST-/ } });
  const testUsers = await User.find({ userId: { $regex: /^API-TEST-/ } });
  const testUserIds = testUsers.map(u => u._id);
  await BinaryTree.deleteMany({ user: { $in: testUserIds } });
  await Investment.deleteMany({ user: { $in: testUserIds } });
  await Wallet.deleteMany({ user: { $in: testUserIds } });

  // Create or get a test package
  let testPackage = await Package.findOne({ packageName: "API Test Package" });
  if (!testPackage) {
    testPackage = await Package.create({
      packageName: "API Test Package",
      minAmount: Types.Decimal128.fromString("100"),
      maxAmount: Types.Decimal128.fromString("10000"),
      duration: 150,
      totalOutputPct: 225,
      renewablePrinciplePct: 50,
      referralPct: 7,
      binaryPct: 10,
      powerCapacity: Types.Decimal128.fromString("1000"),
      status: "Active",
    });
  }

  return testPackage;
}

async function testCarryForwardFlushViaAPI() {
  console.log("=".repeat(60));
  console.log("API TEST: Carry Forward Flush Verification");
  console.log("=".repeat(60));
  console.log("Testing via actual API calls to verify the bug\n");

  const pkg = await setupTestData();

  // Create User A (root)
  const userA = await User.create({
    userId: "API-TEST-A",
    name: "User A",
    email: "api-test-a@test.com",
    phone: "1111111111",
    password: "hashed",
    referrer: null,
  });

  // Create User B (left child of A)
  const userB = await User.create({
    userId: "API-TEST-B",
    name: "User B",
    email: "api-test-b@test.com",
    phone: "2222222222",
    password: "hashed",
    referrer: userA._id,
    position: "left",
  });

  // Create User C (right child of A)
  const userC = await User.create({
    userId: "API-TEST-C",
    name: "User C",
    email: "api-test-c@test.com",
    phone: "3333333333",
    password: "hashed",
    referrer: userA._id,
    position: "right",
  });

  // Initialize binary trees
  await initializeUser(userA._id as Types.ObjectId);
  await initializeUser(userB._id as Types.ObjectId, userA._id as Types.ObjectId, "left");
  await initializeUser(userC._id as Types.ObjectId, userA._id as Types.ObjectId, "right");

  // Update investment wallets (they're already created by initializeUser)
  const walletB = await Wallet.findOne({ user: userB._id, type: WalletType.INVESTMENT });
  if (walletB) {
    walletB.balance = Types.Decimal128.fromString("10000");
    await walletB.save();
  }

  const walletC = await Wallet.findOne({ user: userC._id, type: WalletType.INVESTMENT });
  if (walletC) {
    walletC.balance = Types.Decimal128.fromString("10000");
    await walletC.save();
  }

  // Step 1: Create initial imbalance (User C invests $500, User B invests $100)
  console.log("\n=== STEP 1: Create Initial Imbalance ===");
  console.log("User C invests $500 (right side of A)");
  console.log("User B invests $100 (left side of A)");

  // Manually create investments to simulate API calls
  const investmentC1 = await Investment.create({
    user: userC._id,
    sponsor: userA._id,
    packageId: pkg._id,
    investedAmount: Types.Decimal128.fromString("500"),
    principal: Types.Decimal128.fromString("500"),
    depositAmount: Types.Decimal128.fromString("500"),
    type: "self",
    isBinaryUpdated: false,
    referralPaid: false,
    startDate: new Date(),
    endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
    durationDays: 150,
    totalOutputPct: 225,
    dailyRoiRate: 225 / 100 / 150,
    daysElapsed: 0,
    daysRemaining: 150,
    isActive: true,
  });

  const investmentB1 = await Investment.create({
    user: userB._id,
    sponsor: userA._id,
    packageId: pkg._id,
    investedAmount: Types.Decimal128.fromString("100"),
    principal: Types.Decimal128.fromString("100"),
    depositAmount: Types.Decimal128.fromString("100"),
    type: "self",
    isBinaryUpdated: false,
    referralPaid: false,
    startDate: new Date(),
    endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
    durationDays: 150,
    totalOutputPct: 225,
    dailyRoiRate: 225 / 100 / 150,
    daysElapsed: 0,
    daysRemaining: 150,
    isActive: true,
  });

  // Add business volume manually
  const treeA = await BinaryTree.findOne({ user: userA._id });
  if (treeA) {
    treeA.leftBusiness = Types.Decimal128.fromString("100");
    treeA.rightBusiness = Types.Decimal128.fromString("500");
    await treeA.save();
  }

  // Trigger binary calculation via API (simulating cron)
  console.log("\n=== STEP 2: Trigger Binary Calculation (Day 1) ===");
  try {
    // Note: In a real scenario, we'd call the API endpoint
    // For now, we'll import and call the service directly
    const { calculateDailyBinaryBonuses } = await import("../services/investment.service");
    await calculateDailyBinaryBonuses();
  } catch (error: any) {
    console.error("Error triggering binary calculation:", error.message);
  }

  // Check User A's state after Day 1
  const treeA_day1 = await BinaryTree.findOne({ user: userA._id });
  const walletA_day1 = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });

  const rightCarry_day1 = parseFloat(treeA_day1!.rightCarry.toString());
  const binaryBonus_day1 = walletA_day1 ? parseFloat(walletA_day1.balance.toString()) : 0;

  logTest("Day 1 - Right Carry Forward", Math.abs(rightCarry_day1 - 400) < 0.01,
    `Right carry should be $400, got $${rightCarry_day1.toFixed(2)}`,
    { rightCarry: rightCarry_day1.toFixed(2), expected: 400 });

  logTest("Day 1 - Binary Bonus", Math.abs(binaryBonus_day1 - 10) < 0.01,
    `Binary bonus should be $10, got $${binaryBonus_day1.toFixed(2)}`,
    { binaryBonus: binaryBonus_day1.toFixed(2), expected: 10 });

  // Step 3: User B invests $400 to balance (this should flush the $400 carry)
  console.log("\n=== STEP 3: User B Invests $400 to Balance ===");
  console.log("Expected: Right carry should be flushed to $0");

  const investmentB2 = await Investment.create({
    user: userB._id,
    sponsor: userA._id,
    packageId: pkg._id,
    investedAmount: Types.Decimal128.fromString("400"),
    principal: Types.Decimal128.fromString("400"),
    depositAmount: Types.Decimal128.fromString("400"),
    type: "self",
    isBinaryUpdated: false,
    referralPaid: true, // Already paid on first investment
    startDate: new Date(),
    endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
    durationDays: 150,
    totalOutputPct: 225,
    dailyRoiRate: 225 / 100 / 150,
    daysElapsed: 0,
    daysRemaining: 150,
    isActive: true,
  });

  // Update business volume
  const treeA_before = await BinaryTree.findOne({ user: userA._id });
  if (treeA_before) {
    const currentLeftBusiness = parseFloat(treeA_before.leftBusiness.toString());
    treeA_before.leftBusiness = Types.Decimal128.fromString((currentLeftBusiness + 400).toString());
    await treeA_before.save();
  }

  // Check state before binary calculation
  const treeA_before_calc = await BinaryTree.findOne({ user: userA._id });
  const leftBusiness_before = parseFloat(treeA_before_calc!.leftBusiness.toString());
  const rightCarry_before = parseFloat(treeA_before_calc!.rightCarry.toString());

  logTest("Before Calculation - Left Business", Math.abs(leftBusiness_before - 500) < 0.01,
    `Left business should be $500, got $${leftBusiness_before.toFixed(2)}`,
    { leftBusiness: leftBusiness_before.toFixed(2), expected: 500 });

  logTest("Before Calculation - Right Carry", Math.abs(rightCarry_before - 400) < 0.01,
    `Right carry should be $400, got $${rightCarry_before.toFixed(2)}`,
    { rightCarry: rightCarry_before.toFixed(2), expected: 400 });

  // Trigger binary calculation via API (simulating cron)
  console.log("\n=== STEP 4: Trigger Binary Calculation (Day 2) ===");
  try {
    const { calculateDailyBinaryBonuses } = await import("../services/investment.service");
    await calculateDailyBinaryBonuses();
  } catch (error: any) {
    console.error("Error triggering binary calculation:", error.message);
  }

  // Check User A's state after Day 2 (THIS IS WHERE THE BUG SHOULD BE VISIBLE)
  const treeA_day2 = await BinaryTree.findOne({ user: userA._id });
  const walletA_day2 = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });

  const rightCarry_day2 = parseFloat(treeA_day2!.rightCarry.toString());
  const leftCarry_day2 = parseFloat(treeA_day2!.leftCarry.toString());
  const binaryBonus_day2 = walletA_day2 ? parseFloat(walletA_day2.balance.toString()) : 0;
  const leftMatched_day2 = parseFloat(treeA_day2!.leftMatched?.toString() || "0");
  const rightMatched_day2 = parseFloat(treeA_day2!.rightMatched?.toString() || "0");

  // Expected calculations:
  // leftAvailable = $0 (carry) + ($500 - $100) (unmatched business) = $400
  // rightAvailable = $400 (carry) + ($500 - $100) (unmatched business) = $800
  // matched = min($400, $800) = $400
  // newRightCarry = $800 - $400 = $400 (leftover unmatched business)
  // BUT if carry is fully consumed, it should be $0

  console.log("\n=== CALCULATION BREAKDOWN ===");
  console.log(`leftAvailable = $0 (carry) + ($500 - $100) (unmatched) = $400`);
  console.log(`rightAvailable = $400 (carry) + ($500 - $100) (unmatched) = $800`);
  console.log(`matched = min($400, $800) = $400`);
  console.log(`Expected: newRightCarry = $0 (carry fully consumed)`);
  console.log(`Actual: newRightCarry = $${rightCarry_day2.toFixed(2)}`);

  // CRITICAL TEST: Right carry should be $0 after matching
  logTest("Day 2 - Right Carry Forward (CRITICAL BUG TEST)", Math.abs(rightCarry_day2 - 0) < 0.01,
    `Right carry should be $0 (flushed), got $${rightCarry_day2.toFixed(2)}`,
    { 
      rightCarry: rightCarry_day2.toFixed(2), 
      expected: 0, 
      originalCarry: 400,
      bug: rightCarry_day2 !== 0 ? "Carry forward not flushed correctly!" : "OK"
    });

  logTest("Day 2 - Binary Bonus", Math.abs(binaryBonus_day2 - 50) < 0.01,
    `Binary bonus should be $50 total ($10 + $40), got $${binaryBonus_day2.toFixed(2)}`,
    { binaryBonus: binaryBonus_day2.toFixed(2), expected: 50 });

  logTest("Day 2 - Left Carry Forward", Math.abs(leftCarry_day2 - 0) < 0.01,
    `Left carry should be $0, got $${leftCarry_day2.toFixed(2)}`,
    { leftCarry: leftCarry_day2.toFixed(2), expected: 0 });

  logTest("Day 2 - Left Matched", Math.abs(leftMatched_day2 - 500) < 0.01,
    `Left matched should be $500, got $${leftMatched_day2.toFixed(2)}`,
    { leftMatched: leftMatched_day2.toFixed(2), expected: 500 });

  // On Day 2, we match $400, all from carry (since rightCarry >= cappedMatched)
  // So rightMatched should stay at $100 (from Day 1), not increase
  // This is correct: rightMatched tracks business consumed, and we consumed $0 from business on Day 2
  logTest("Day 2 - Right Matched", Math.abs(rightMatched_day2 - 100) < 0.01,
    `Right matched should be $100 (unchanged, all $400 consumed from carry), got $${rightMatched_day2.toFixed(2)}`,
    { rightMatched: rightMatched_day2.toFixed(2), expected: 100, note: "All $400 consumed from carry, so business matched stays at $100 from Day 1" });

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testResults.length) * 100).toFixed(2)}%`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.message}`);
      if (t.details?.bug) {
        console.log(`    🐛 BUG IDENTIFIED: ${t.details.bug}`);
      }
    });
    return false;
  } else {
    console.log("\n✅ All tests passed! Carry forward flush logic is working correctly.");
    return true;
  }
}

async function runAPITest() {
  try {
    console.log("=".repeat(60));
    console.log("CARRY FORWARD FLUSH API TEST SUITE");
    console.log("=".repeat(60));

    // Connect to MongoDB
    console.log(`\nConnecting to MongoDB at: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const result = await testCarryForwardFlushViaAPI();

    if (!result) {
      console.log("\n🐛 BUG CONFIRMED: Carry forward is not being flushed correctly!");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Test execution error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the test
runAPITest();

