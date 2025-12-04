/**
 * Comprehensive Unit Test: Carry Forward Flush After Matching
 * 
 * Tests multiple scenarios where carry forward should be flushed after binary matching
 * 
 * Scenarios:
 * 1. Basic flush: User A has $400 right carry, left referral invests $400
 * 2. Complex tree: Multiple users with carry forward being used multiple times
 * 
 * Usage: npm run test:carry-forward
 * Or: npx ts-node -r dotenv/config src/scripts/testCarryForwardFlush.ts
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

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "mongodb://localhost:27017/binary_system";

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
  await User.deleteMany({ userId: { $regex: /^CARRY-TEST-/ } });
  const testUsers = await User.find({ userId: { $regex: /^CARRY-TEST-/ } });
  const testUserIds = testUsers.map(u => u._id);
  await BinaryTree.deleteMany({ user: { $in: testUserIds } });
  await Investment.deleteMany({ user: { $in: testUserIds } });
  await Wallet.deleteMany({ user: { $in: testUserIds } });

  // Create or get a test package
  let testPackage = await Package.findOne({ packageName: "Carry Forward Test Package" });
  if (!testPackage) {
    testPackage = await Package.create({
      packageName: "Carry Forward Test Package",
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

async function testScenario1_CarryFlushWithNoBusiness() {
  console.log("=".repeat(60));
  console.log("SCENARIO 1: Carry Forward Flush (No Business on One Side)");
  console.log("=".repeat(60));
  console.log("User A has $400 right carry, $0 left business");
  console.log("User A's left referral invests $400");
  console.log("Expected: Right carry should be $0 after matching\n");

  const pkg = await setupTestData();

  // Create User A (root)
  const userA = await User.create({
    userId: "CARRY-TEST-A1",
    name: "User A",
    email: "carry-a1@test.com",
    phone: "1111111111",
    password: "hashed",
    referrer: null,
  });

  // Create User B (left child of A)
  const userB = await User.create({
    userId: "CARRY-TEST-B1",
    name: "User B",
    email: "carry-b1@test.com",
    phone: "2222222222",
    password: "hashed",
    referrer: userA._id,
    position: "left",
  });

  // Create User C (right child of A)
  const userC = await User.create({
    userId: "CARRY-TEST-C1",
    name: "User C",
    email: "carry-c1@test.com",
    phone: "3333333333",
    password: "hashed",
    referrer: userA._id,
    position: "right",
  });

  // Create binary trees
  const treeA = await BinaryTree.create({
    user: userA._id,
    leftBusiness: Types.Decimal128.fromString("0"),
    rightBusiness: Types.Decimal128.fromString("0"),
    leftCarry: Types.Decimal128.fromString("0"),
    rightCarry: Types.Decimal128.fromString("400"), // Start with $400 right carry
    leftMatched: Types.Decimal128.fromString("0"),
    rightMatched: Types.Decimal128.fromString("0"),
    leftDownlines: 0,
    rightDownlines: 0,
  });

  const treeB = await BinaryTree.create({
    user: userB._id,
    parent: userA._id,
    leftBusiness: Types.Decimal128.fromString("0"),
    rightBusiness: Types.Decimal128.fromString("0"),
    leftCarry: Types.Decimal128.fromString("0"),
    rightCarry: Types.Decimal128.fromString("0"),
    leftMatched: Types.Decimal128.fromString("0"),
    rightMatched: Types.Decimal128.fromString("0"),
    leftDownlines: 0,
    rightDownlines: 0,
  });

  const treeC = await BinaryTree.create({
    user: userC._id,
    parent: userA._id,
    leftBusiness: Types.Decimal128.fromString("0"),
    rightBusiness: Types.Decimal128.fromString("0"),
    leftCarry: Types.Decimal128.fromString("0"),
    rightCarry: Types.Decimal128.fromString("0"),
    leftMatched: Types.Decimal128.fromString("0"),
    rightMatched: Types.Decimal128.fromString("0"),
    leftDownlines: 0,
    rightDownlines: 0,
  });

  // Set up binary tree relationships
  treeA.leftChild = userB._id as Types.ObjectId;
  treeA.rightChild = userC._id as Types.ObjectId;
  await treeA.save();

  // Create investment wallets
  await Wallet.create({
    user: userB._id,
    type: WalletType.INVESTMENT,
    balance: Types.Decimal128.fromString("1000"),
    reserved: Types.Decimal128.fromString("0"),
    currency: "USD",
  });

  // Verify initial state
  const treeA_initial = await BinaryTree.findOne({ user: userA._id });
  const rightCarry_initial = parseFloat(treeA_initial!.rightCarry.toString());
  logTest("Initial - Right Carry Forward", Math.abs(rightCarry_initial - 400) < 0.01,
    `Right carry should be $400 initially, got $${rightCarry_initial.toFixed(2)}`,
    { rightCarry: rightCarry_initial.toFixed(2), expected: 400 });

  // User B invests $400 (left side of A)
  console.log("\nUser B invests $400...");
  await processInvestment(userB._id as Types.ObjectId, pkg._id as Types.ObjectId, 400);

  // Check state after investment
  const treeA_after_invest = await BinaryTree.findOne({ user: userA._id });
  const leftBusiness_after = parseFloat(treeA_after_invest!.leftBusiness.toString());
  logTest("After Investment - Left Business", Math.abs(leftBusiness_after - 400) < 0.01,
    `Left business should be $400, got $${leftBusiness_after.toFixed(2)}`,
    { leftBusiness: leftBusiness_after.toFixed(2), expected: 400 });

  // Trigger binary bonus calculation
  console.log("\nTriggering binary bonus calculation...");
  await calculateDailyBinaryBonuses();

  // Check final state
  const treeA_final = await BinaryTree.findOne({ user: userA._id });
  const walletA_final = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });

  const binaryBonus = walletA_final ? parseFloat(walletA_final.balance.toString()) : 0;
  const rightCarry_final = parseFloat(treeA_final!.rightCarry.toString());
  const leftCarry_final = parseFloat(treeA_final!.leftCarry.toString());
  const leftMatched_final = parseFloat(treeA_final!.leftMatched?.toString() || "0");
  const rightMatched_final = parseFloat(treeA_final!.rightMatched?.toString() || "0");

  // Expected: leftAvailable = $0 + ($400 - $0) = $400
  // Expected: rightAvailable = $400 + ($0 - $0) = $400
  // Expected: matched = $400
  // Expected: newRightCarry = $400 - $400 = $0 (CARRY SHOULD BE FLUSHED)
  // Expected: newLeftCarry = $400 - $400 = $0
  // Expected: binaryBonus = $400 × 10% = $40

  logTest("Scenario 1 - Binary Bonus", Math.abs(binaryBonus - 40) < 0.01,
    `Binary bonus should be $40, got $${binaryBonus.toFixed(2)}`,
    { binaryBonus: binaryBonus.toFixed(2), expected: 40 });

  logTest("Scenario 1 - Right Carry Forward (CRITICAL)", Math.abs(rightCarry_final - 0) < 0.01,
    `Right carry should be $0 (flushed), got $${rightCarry_final.toFixed(2)}`,
    { rightCarry: rightCarry_final.toFixed(2), expected: 0, originalCarry: 400 });

  logTest("Scenario 1 - Left Carry Forward", Math.abs(leftCarry_final - 0) < 0.01,
    `Left carry should be $0, got $${leftCarry_final.toFixed(2)}`,
    { leftCarry: leftCarry_final.toFixed(2), expected: 0 });

  logTest("Scenario 1 - Left Matched", Math.abs(leftMatched_final - 400) < 0.01,
    `Left matched should be $400, got $${leftMatched_final.toFixed(2)}`,
    { leftMatched: leftMatched_final.toFixed(2), expected: 400 });

  logTest("Scenario 1 - Right Matched", Math.abs(rightMatched_final - 0) < 0.01,
    `Right matched should be $0 (all from carry), got $${rightMatched_final.toFixed(2)}`,
    { rightMatched: rightMatched_final.toFixed(2), expected: 0 });
}

async function testScenario2_ComplexTree() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 2: Complex Tree with Multiple Carry Forward Uses");
  console.log("=".repeat(60));

  const pkg = await setupTestData();

  // Create a 3-level tree: A -> B(left), C(right) -> D(left of B), E(right of B), F(left of C), G(right of C)
  const users: any[] = [];
  const trees: any[] = [];

  // Level 1: User A
  const userA = await User.create({
    userId: "CARRY-TEST-A2",
    name: "User A",
    email: "carry-a2@test.com",
    phone: "1111111111",
    password: "hashed",
    referrer: null,
  });
  users.push(userA);

  // Level 2: User B (left), User C (right)
  const userB = await User.create({
    userId: "CARRY-TEST-B2",
    name: "User B",
    email: "carry-b2@test.com",
    phone: "2222222222",
    password: "hashed",
    referrer: userA._id,
    position: "left",
  });
  users.push(userB);

  const userC = await User.create({
    userId: "CARRY-TEST-C2",
    name: "User C",
    email: "carry-c2@test.com",
    phone: "3333333333",
    password: "hashed",
    referrer: userA._id,
    position: "right",
  });
  users.push(userC);

  // Level 3: D (left of B), E (right of B), F (left of C), G (right of C)
  const userD = await User.create({
    userId: "CARRY-TEST-D2",
    name: "User D",
    email: "carry-d2@test.com",
    phone: "4444444444",
    password: "hashed",
    referrer: userB._id,
    position: "left",
  });
  users.push(userD);

  const userE = await User.create({
    userId: "CARRY-TEST-E2",
    name: "User E",
    email: "carry-e2@test.com",
    phone: "5555555555",
    password: "hashed",
    referrer: userB._id,
    position: "right",
  });
  users.push(userE);

  const userF = await User.create({
    userId: "CARRY-TEST-F2",
    name: "User F",
    email: "carry-f2@test.com",
    phone: "6666666666",
    password: "hashed",
    referrer: userC._id,
    position: "left",
  });
  users.push(userF);

  const userG = await User.create({
    userId: "CARRY-TEST-G2",
    name: "User G",
    email: "carry-g2@test.com",
    phone: "7777777777",
    password: "hashed",
    referrer: userC._id,
    position: "right",
  });
  users.push(userG);

  // Create binary trees for all users
  for (const user of users) {
    const tree = await BinaryTree.create({
      user: user._id,
      leftBusiness: Types.Decimal128.fromString("0"),
      rightBusiness: Types.Decimal128.fromString("0"),
      leftCarry: Types.Decimal128.fromString("0"),
      rightCarry: Types.Decimal128.fromString("0"),
      leftMatched: Types.Decimal128.fromString("0"),
      rightMatched: Types.Decimal128.fromString("0"),
      leftDownlines: 0,
      rightDownlines: 0,
    });
    trees.push({ user, tree });
  }

  // Set up tree relationships
  const treeA = trees.find(t => t.user.userId === "CARRY-TEST-A2")!.tree;
  const treeB = trees.find(t => t.user.userId === "CARRY-TEST-B2")!.tree;
  const treeC = trees.find(t => t.user.userId === "CARRY-TEST-C2")!.tree;
  const treeD = trees.find(t => t.user.userId === "CARRY-TEST-D2")!.tree;
  const treeE = trees.find(t => t.user.userId === "CARRY-TEST-E2")!.tree;
  const treeF = trees.find(t => t.user.userId === "CARRY-TEST-F2")!.tree;
  const treeG = trees.find(t => t.user.userId === "CARRY-TEST-G2")!.tree;

  treeA.leftChild = userB._id as Types.ObjectId;
  treeA.rightChild = userC._id as Types.ObjectId;
  treeB.leftChild = userD._id as Types.ObjectId;
  treeB.rightChild = userE._id as Types.ObjectId;
  treeC.leftChild = userF._id as Types.ObjectId;
  treeC.rightChild = userG._id as Types.ObjectId;

  await treeA.save();
  await treeB.save();
  await treeC.save();

  // Create investment wallets for all users
  for (const user of users) {
    await Wallet.create({
      user: user._id,
      type: WalletType.INVESTMENT,
      balance: Types.Decimal128.fromString("10000"),
      reserved: Types.Decimal128.fromString("0"),
      currency: "USD",
    });
  }

  console.log("\n=== Phase 1: Create Initial Imbalance ===");
  // User D invests $100 (left of B, left of A)
  await processInvestment(userD._id as Types.ObjectId, pkg._id as Types.ObjectId, 100);
  // User G invests $500 (right of C, right of A)
  await processInvestment(userG._id as Types.ObjectId, pkg._id as Types.ObjectId, 500);

  // Trigger Day 1 cron
  await calculateDailyBinaryBonuses();

  // Check User A's state after Day 1
  const treeA_phase1 = await BinaryTree.findOne({ user: userA._id });
  const rightCarry_phase1 = parseFloat(treeA_phase1!.rightCarry.toString());
  logTest("Phase 1 - User A Right Carry", Math.abs(rightCarry_phase1 - 400) < 0.01,
    `User A right carry should be $400, got $${rightCarry_phase1.toFixed(2)}`,
    { rightCarry: rightCarry_phase1.toFixed(2), expected: 400 });

  console.log("\n=== Phase 2: Use Carry Forward (User A) ===");
  // User D invests $400 to balance User A's tree
  await processInvestment(userD._id as Types.ObjectId, pkg._id as Types.ObjectId, 400);

  // Trigger Day 2 cron
  await calculateDailyBinaryBonuses();

  const treeA_phase2 = await BinaryTree.findOne({ user: userA._id });
  const rightCarry_phase2 = parseFloat(treeA_phase2!.rightCarry.toString());
  const walletA_phase2 = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });
  const binaryBonus_phase2 = walletA_phase2 ? parseFloat(walletA_phase2.balance.toString()) : 0;

  logTest("Phase 2 - User A Right Carry (CRITICAL)", Math.abs(rightCarry_phase2 - 0) < 0.01,
    `User A right carry should be $0 (flushed), got $${rightCarry_phase2.toFixed(2)}`,
    { rightCarry: rightCarry_phase2.toFixed(2), expected: 0, originalCarry: 400 });

  logTest("Phase 2 - User A Binary Bonus", Math.abs(binaryBonus_phase2 - 50) < 0.01,
    `User A binary bonus should be $50 ($10 + $40), got $${binaryBonus_phase2.toFixed(2)}`,
    { binaryBonus: binaryBonus_phase2.toFixed(2), expected: 50 });

  console.log("\n=== Phase 3: Create Another Imbalance (User B) ===");
  // User E invests $300 (right of B)
  await processInvestment(userE._id as Types.ObjectId, pkg._id as Types.ObjectId, 300);

  // Trigger Day 3 cron
  await calculateDailyBinaryBonuses();

  // Check User B's state
  const treeB_phase3 = await BinaryTree.findOne({ user: userB._id });
  const rightCarry_phase3 = parseFloat(treeB_phase3!.rightCarry.toString());
  logTest("Phase 3 - User B Right Carry", Math.abs(rightCarry_phase3 - 300) < 0.01,
    `User B right carry should be $300, got $${rightCarry_phase3.toFixed(2)}`,
    { rightCarry: rightCarry_phase3.toFixed(2), expected: 300 });

  console.log("\n=== Phase 4: Use Carry Forward (User B) ===");
  // User D invests $300 to balance User B's tree
  await processInvestment(userD._id as Types.ObjectId, pkg._id as Types.ObjectId, 300);

  // Trigger Day 4 cron
  await calculateDailyBinaryBonuses();

  const treeB_phase4 = await BinaryTree.findOne({ user: userB._id });
  const rightCarry_phase4 = parseFloat(treeB_phase4!.rightCarry.toString());
  const walletB_phase4 = await Wallet.findOne({ user: userB._id, type: WalletType.BINARY });
  const binaryBonus_phase4 = walletB_phase4 ? parseFloat(walletB_phase4.balance.toString()) : 0;

  logTest("Phase 4 - User B Right Carry (CRITICAL)", Math.abs(rightCarry_phase4 - 0) < 0.01,
    `User B right carry should be $0 (flushed), got $${rightCarry_phase4.toFixed(2)}`,
    { rightCarry: rightCarry_phase4.toFixed(2), expected: 0, originalCarry: 300 });

  logTest("Phase 4 - User B Binary Bonus", binaryBonus_phase4 >= 30,
    `User B binary bonus should be at least $30, got $${binaryBonus_phase4.toFixed(2)}`,
    { binaryBonus: binaryBonus_phase4.toFixed(2), expected: ">= 30" });

  console.log("\n=== Phase 5: Multiple Carry Forward Uses (User A Again) ===");
  // Create another imbalance for User A
  // User F invests $200 (left of C, right of A)
  await processInvestment(userF._id as Types.ObjectId, pkg._id as Types.ObjectId, 200);

  // Trigger Day 5 cron
  await calculateDailyBinaryBonuses();

  const treeA_phase5_before = await BinaryTree.findOne({ user: userA._id });
  const rightCarry_phase5_before = parseFloat(treeA_phase5_before!.rightCarry.toString());
  console.log(`User A right carry before balancing: $${rightCarry_phase5_before.toFixed(2)}`);

  // User D invests to balance (ensure minimum $100)
  const balanceAmount = Math.max(100, Math.ceil(rightCarry_phase5_before));
  await processInvestment(userD._id as Types.ObjectId, pkg._id as Types.ObjectId, balanceAmount);

  // Trigger Day 6 cron
  await calculateDailyBinaryBonuses();

  const treeA_phase5_after = await BinaryTree.findOne({ user: userA._id });
  const rightCarry_phase5_after = parseFloat(treeA_phase5_after!.rightCarry.toString());

  logTest("Phase 5 - User A Right Carry After Multiple Uses (CRITICAL)", rightCarry_phase5_after < rightCarry_phase5_before,
    `User A right carry should be reduced (was $${rightCarry_phase5_before.toFixed(2)}, now $${rightCarry_phase5_after.toFixed(2)})`,
    { rightCarryBefore: rightCarry_phase5_before.toFixed(2), rightCarryAfter: rightCarry_phase5_after.toFixed(2) });
}

async function runTests() {
  try {
    console.log("=".repeat(60));
    console.log("COMPREHENSIVE CARRY FORWARD FLUSH TEST");
    console.log("=".repeat(60));

    // Connect to MongoDB
    console.log(`\nConnecting to MongoDB at: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Run Scenario 1: Basic carry flush
    await testScenario1_CarryFlushWithNoBusiness();

    // Run Scenario 2: Complex tree
    await testScenario2_ComplexTree();

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
      });
      process.exit(1);
    } else {
      console.log("\n✅ All tests passed! Carry forward flush logic is working correctly.");
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

// Run the tests
runTests();
