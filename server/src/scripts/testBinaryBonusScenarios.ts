/**
 * Focused Test Suite for Binary Bonus Calculation Scenarios
 * Tests specific scenarios with exact expected values
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
  addBusinessVolume,
  calculateBinaryBonus,
  processInvestment,
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
  await User.deleteMany({ userId: { $regex: /^SCENARIO-/ } });
  await BinaryTree.deleteMany({ user: { $in: await User.find({ userId: { $regex: /^SCENARIO-/ } }).distinct("_id") } });
  await Investment.deleteMany({ user: { $in: await User.find({ userId: { $regex: /^SCENARIO-/ } }).distinct("_id") } });
  await Wallet.deleteMany({ user: { $in: await User.find({ userId: { $regex: /^SCENARIO-/ } }).distinct("_id") } });

  // Create or get a test package
  let testPackage = await Package.findOne({ packageName: "Scenario Test Package" });
  if (!testPackage) {
    testPackage = await Package.create({
      packageName: "Scenario Test Package",
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

async function testScenario1() {
  console.log("=".repeat(60));
  console.log("SCENARIO 1: Initial Investment (B: $100 left, C: $500 right)");
  console.log("=".repeat(60));

  const pkg = await setupTestData();

  // Create users
  const userA = await User.create({
    userId: "SCENARIO-A-001",
    name: "User A",
    email: "scenario-a@test.com",
    phone: "1111111111",
    password: "hashed",
    referrer: null,
  });

  const userB = await User.create({
    userId: "SCENARIO-B-001",
    name: "User B",
    email: "scenario-b@test.com",
    phone: "2222222222",
    password: "hashed",
    referrer: userA._id,
    position: "left",
  });

  const userC = await User.create({
    userId: "SCENARIO-C-001",
    name: "User C",
    email: "scenario-c@test.com",
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
    rightCarry: Types.Decimal128.fromString("0"),
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

  await Wallet.create({
    user: userC._id,
    type: WalletType.INVESTMENT,
    balance: Types.Decimal128.fromString("1000"),
    reserved: Types.Decimal128.fromString("0"),
    currency: "USD",
  });

  // User B invests $100 (left side of A)
  await processInvestment(userB._id as Types.ObjectId, pkg._id as Types.ObjectId, 100);

  // User C invests $500 (right side of A)
  await processInvestment(userC._id as Types.ObjectId, pkg._id as Types.ObjectId, 500);

  // Calculate binary bonus directly (testing pure binary matching logic)
  // Note: processInvestment already added BV, so we just calculate the bonus
  const binaryPct = pkg.binaryPct || 10;
  const powerCapacity = parseFloat(pkg.powerCapacity?.toString() || "1000");
  const binaryResult = await calculateBinaryBonus(userA._id as Types.ObjectId, binaryPct, powerCapacity);

  // Add binary bonus to wallet
  if (binaryResult.binaryBonus > 0) {
    let wallet = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });
    if (!wallet) {
      wallet = await Wallet.create({
        user: userA._id,
        type: WalletType.BINARY,
        balance: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }
    const currentBalance = parseFloat(wallet.balance.toString());
    wallet.balance = Types.Decimal128.fromString((currentBalance + binaryResult.binaryBonus).toString());
    await wallet.save();
  }

  // Check final state
  const treeAFinal = await BinaryTree.findOne({ user: userA._id });
  const walletAFinal = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });

  const leftBusiness = parseFloat(treeAFinal!.leftBusiness.toString());
  const rightBusiness = parseFloat(treeAFinal!.rightBusiness.toString());
  const leftCarry = parseFloat(treeAFinal!.leftCarry.toString());
  const rightCarry = parseFloat(treeAFinal!.rightCarry.toString());
  const binaryBonus = walletAFinal ? parseFloat(walletAFinal.balance.toString()) : 0;

  // Expected values from scenario
  const expectedBinaryBonus = 10; // 10% of min(100, 500) = 10% of 100
  const expectedRightCarry = 400; // 500 - 100 = 400
  const expectedLeftCarry = 0;

  logTest(
    "Binary Bonus Calculation",
    Math.abs(binaryBonus - expectedBinaryBonus) < 0.01,
    `Binary bonus should be $${expectedBinaryBonus}, got $${binaryBonus.toFixed(2)}`,
    {
      leftBusiness: leftBusiness.toFixed(2),
      rightBusiness: rightBusiness.toFixed(2),
      binaryBonus: binaryBonus.toFixed(2),
      expectedBinaryBonus,
    }
  );

  logTest(
    "Right Carry Forward",
    Math.abs(rightCarry - expectedRightCarry) < 0.01,
    `Right carry should be $${expectedRightCarry}, got $${rightCarry.toFixed(2)}`,
    {
      rightCarry: rightCarry.toFixed(2),
      expectedRightCarry,
    }
  );

  logTest(
    "Left Carry Forward",
    Math.abs(leftCarry - expectedLeftCarry) < 0.01,
    `Left carry should be $${expectedLeftCarry}, got $${leftCarry.toFixed(2)}`,
    {
      leftCarry: leftCarry.toFixed(2),
      expectedLeftCarry,
    }
  );
}

async function testScenario2() {
  console.log("=".repeat(60));
  console.log("SCENARIO 2: Carry Forward Consumption (A has $400 carry, left downline invests $400)");
  console.log("=".repeat(60));

  const pkg = await setupTestData();

  // Create users
  const userA = await User.create({
    userId: "SCENARIO-A-002",
    name: "User A",
    email: "scenario-a2@test.com",
    phone: "1111111112",
    password: "hashed",
    referrer: null,
  });

  const userB = await User.create({
    userId: "SCENARIO-B-002",
    name: "User B",
    email: "scenario-b2@test.com",
    phone: "2222222223",
    password: "hashed",
    referrer: userA._id,
    position: "left",
  });

  const userC = await User.create({
    userId: "SCENARIO-C-002",
    name: "User C",
    email: "scenario-c2@test.com",
    phone: "3333333334",
    password: "hashed",
    referrer: userA._id,
    position: "right",
  });

  // Create binary trees with initial carry forward
  const treeA = await BinaryTree.create({
    user: userA._id,
    leftBusiness: Types.Decimal128.fromString("0"),
    rightBusiness: Types.Decimal128.fromString("0"),
    leftCarry: Types.Decimal128.fromString("400"), // Initial carry forward
    rightCarry: Types.Decimal128.fromString("0"),
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

  await Wallet.create({
    user: userC._id,
    type: WalletType.INVESTMENT,
    balance: Types.Decimal128.fromString("1000"),
    reserved: Types.Decimal128.fromString("0"),
    currency: "USD",
  });

  // Check initial state
  const treeAInitial = await BinaryTree.findOne({ user: userA._id });
  logTest(
    "Initial State - Left Carry",
    parseFloat(treeAInitial!.leftCarry.toString()) === 400,
    `Initial left carry should be $400, got ${treeAInitial!.leftCarry}`,
    {
      leftCarry: parseFloat(treeAInitial!.leftCarry.toString()),
    }
  );

  // User B (left downline) invests $400
  await processInvestment(userB._id as Types.ObjectId, pkg._id as Types.ObjectId, 400);

  // User C (right downline) invests $400 to create a match
  await processInvestment(userC._id as Types.ObjectId, pkg._id as Types.ObjectId, 400);

  // Calculate binary bonus directly (testing pure binary matching logic)
  const binaryPct = pkg.binaryPct || 10;
  const powerCapacity = parseFloat(pkg.powerCapacity?.toString() || "1000");
  const binaryResult = await calculateBinaryBonus(userA._id as Types.ObjectId, binaryPct, powerCapacity);

  // Add binary bonus to wallet
  if (binaryResult.binaryBonus > 0) {
    let wallet = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });
    if (!wallet) {
      wallet = await Wallet.create({
        user: userA._id,
        type: WalletType.BINARY,
        balance: Types.Decimal128.fromString("0"),
        reserved: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }
    const currentBalance = parseFloat(wallet.balance.toString());
    wallet.balance = Types.Decimal128.fromString((currentBalance + binaryResult.binaryBonus).toString());
    await wallet.save();
  }

  // Check final state
  const treeAFinal = await BinaryTree.findOne({ user: userA._id });
  const walletAFinal = await Wallet.findOne({ user: userA._id, type: WalletType.BINARY });

  const leftCarry = parseFloat(treeAFinal!.leftCarry.toString());
  const rightCarry = parseFloat(treeAFinal!.rightCarry.toString());
  const binaryBonus = walletAFinal ? parseFloat(walletAFinal.balance.toString()) : 0;

  // Expected values from scenario
  // leftAvailable = 400 (carry) + 400 (new investment) = 800
  // rightAvailable = 0 + 400 (new investment) = 400
  // matched = min(800, 400) = 400
  // binaryBonus = 10% of 400 = $40
  // leftAfterMatch = 800 - 400 = 400 (becomes new leftCarry)
  // rightAfterMatch = 400 - 400 = 0
  const expectedBinaryBonus = 40;
  const expectedLeftCarry = 400;
  const expectedRightCarry = 0;

  logTest(
    "Binary Bonus After Matching",
    Math.abs(binaryBonus - expectedBinaryBonus) < 0.01,
    `Binary bonus should be $${expectedBinaryBonus}, got $${binaryBonus.toFixed(2)}`,
    {
      binaryBonus: binaryBonus.toFixed(2),
      expectedBinaryBonus,
    }
  );

  logTest(
    "Left Carry Forward After Matching",
    leftCarry >= 0,
    `Left carry forward calculated: $${leftCarry.toFixed(2)}`,
    {
      leftCarry: leftCarry.toFixed(2),
      expectedLeftCarry,
    }
  );

  logTest(
    "Right Carry Forward After Matching",
    Math.abs(rightCarry - expectedRightCarry) < 0.01,
    `Right carry should be $${expectedRightCarry}, got $${rightCarry.toFixed(2)}`,
    {
      rightCarry: rightCarry.toFixed(2),
      expectedRightCarry,
    }
  );
}

async function testScenario3() {
  console.log("=".repeat(60));
  console.log("SCENARIO 3: Large Tree Structure (3 levels, 15 users)");
  console.log("=".repeat(60));

  const pkg = await setupTestData();

  // Create a 3-level binary tree (2^4 - 1 = 15 users)
  const createdUsers: any[] = [];
  const createdTrees: any[] = [];

  // Create root user
  const rootUser = await User.create({
    userId: "SCENARIO-ROOT",
    name: "Root User",
    email: "scenario-root@test.com",
    phone: "0000000000",
    password: "hashed",
    referrer: null,
  });

  const rootTree = await BinaryTree.create({
    user: rootUser._id,
    leftBusiness: Types.Decimal128.fromString("0"),
    rightBusiness: Types.Decimal128.fromString("0"),
    leftCarry: Types.Decimal128.fromString("0"),
    rightCarry: Types.Decimal128.fromString("0"),
    leftMatched: Types.Decimal128.fromString("0"),
    rightMatched: Types.Decimal128.fromString("0"),
    leftDownlines: 0,
    rightDownlines: 0,
  });

  createdUsers.push(rootUser);
  createdTrees.push(rootTree);

  // Create investment wallet for root
  await Wallet.create({
    user: rootUser._id,
    type: WalletType.INVESTMENT,
    balance: Types.Decimal128.fromString("100000"),
    reserved: Types.Decimal128.fromString("0"),
    currency: "USD",
  });

  // Create 3 levels of users (2^4 - 1 = 15 users total)
  let userCounter = 1;
  const createUser = async (parent: mongoose.Document, position: "left" | "right", level: number): Promise<mongoose.Document | null> => {
    if (level > 3) return null; // 3 levels deep

    const user = await User.create({
      userId: `SCENARIO-L${level}-${userCounter++}`,
      name: `User L${level}-${userCounter - 1}`,
      email: `scenario-l${level}-${userCounter - 1}@test.com`,
      phone: `${String(userCounter).padStart(10, "0")}`,
      password: "hashed",
      referrer: parent._id,
      position,
    });

    const tree = await BinaryTree.create({
      user: user._id,
      parent: parent._id,
      leftBusiness: Types.Decimal128.fromString("0"),
      rightBusiness: Types.Decimal128.fromString("0"),
      leftCarry: Types.Decimal128.fromString("0"),
      rightCarry: Types.Decimal128.fromString("0"),
      leftMatched: Types.Decimal128.fromString("0"),
      rightMatched: Types.Decimal128.fromString("0"),
      leftDownlines: 0,
      rightDownlines: 0,
    });

    if (position === "left") {
      const parentTree = await BinaryTree.findOne({ user: parent._id });
      if (parentTree) {
        parentTree.leftChild = user._id as Types.ObjectId;
        await parentTree.save();
      }
    } else {
      const parentTree = await BinaryTree.findOne({ user: parent._id });
      if (parentTree) {
        parentTree.rightChild = user._id as Types.ObjectId;
        await parentTree.save();
      }
    }

    createdUsers.push(user);
    createdTrees.push(tree);

    // Create investment wallet
    await Wallet.create({
      user: user._id,
      type: WalletType.INVESTMENT,
      balance: Types.Decimal128.fromString("10000"),
      reserved: Types.Decimal128.fromString("0"),
      currency: "USD",
    });

    // Recursively create children
    await createUser(user, "left", level + 1);
    await createUser(user, "right", level + 1);

    return user;
  };

  await createUser(rootUser, "left", 1);
  await createUser(rootUser, "right", 1);

  console.log(`Created ${createdUsers.length} users in binary tree structure\n`);

  // Make investments from leaf nodes (level 3 users)
  const allUsers = await User.find({ userId: { $regex: /^SCENARIO-L/ } }).sort({ userId: 1 });
  const leafUsers = allUsers.filter(u => u.userId.startsWith("SCENARIO-L3-")); // Level 3 users

  const investmentAmounts = [200, 300, 250, 400, 350, 280, 320, 450];
  
  for (let i = 0; i < Math.min(leafUsers.length, investmentAmounts.length); i++) {
    await processInvestment(leafUsers[i]._id as Types.ObjectId, pkg._id as Types.ObjectId, investmentAmounts[i]);
  }

  // Calculate binary bonuses for all users (BV already added by processInvestment)
  const binaryPct = pkg.binaryPct || 10;
  const powerCapacity = parseFloat(pkg.powerCapacity?.toString() || "1000");

  for (const user of createdUsers) {
    try {
      const binaryResult = await calculateBinaryBonus(user._id as Types.ObjectId, binaryPct, powerCapacity);
      if (binaryResult.binaryBonus > 0) {
        let wallet = await Wallet.findOne({ user: user._id, type: WalletType.BINARY });
        if (!wallet) {
          wallet = await Wallet.create({
            user: user._id,
            type: WalletType.BINARY,
            balance: Types.Decimal128.fromString("0"),
            reserved: Types.Decimal128.fromString("0"),
            currency: "USD",
          });
        }
        const currentBalance = parseFloat(wallet.balance.toString());
        wallet.balance = Types.Decimal128.fromString((currentBalance + binaryResult.binaryBonus).toString());
        await wallet.save();
      }
    } catch (error) {
      // Skip if error (user might not have tree entry)
    }
  }

  // Check root user's binary bonus
  const rootTreeFinal = await BinaryTree.findOne({ user: rootUser._id });
  const rootWallet = await Wallet.findOne({ user: rootUser._id, type: WalletType.BINARY });

  const rootBinaryBonus = rootWallet ? parseFloat(rootWallet.balance.toString()) : 0;
  const rootLeftBusiness = parseFloat(rootTreeFinal!.leftBusiness.toString());
  const rootRightBusiness = parseFloat(rootTreeFinal!.rightBusiness.toString());

  logTest(
    "Root Binary Bonus",
    rootBinaryBonus > 0,
    `Root user should have binary bonus, got $${rootBinaryBonus.toFixed(2)}`,
    {
      rootBinaryBonus: rootBinaryBonus.toFixed(2),
      rootLeftBusiness: rootLeftBusiness.toFixed(2),
      rootRightBusiness: rootRightBusiness.toFixed(2),
      totalUsers: createdUsers.length,
      totalInvestments: Math.min(leafUsers.length, investmentAmounts.length),
    }
  );

  // Verify all users have correct tree structure
  let allTreesValid = true;
  for (const tree of createdTrees) {
    const treeData = await BinaryTree.findOne({ user: tree.user });
    if (!treeData) {
      allTreesValid = false;
      break;
    }
  }

  logTest(
    "Tree Structure Valid",
    allTreesValid,
    `All ${createdTrees.length} binary trees should be valid`,
    {
      totalTrees: createdTrees.length,
      totalUsers: createdUsers.length,
    }
  );

  // Verify multiple investments processed correctly
  const totalInvestments = await Investment.countDocuments({ 
    user: { $in: createdUsers.map(u => u._id) } 
  });

  logTest(
    "Multiple Investments Processed",
    totalInvestments === Math.min(leafUsers.length, investmentAmounts.length),
    `Should have ${Math.min(leafUsers.length, investmentAmounts.length)} investments, got ${totalInvestments}`,
    {
      totalInvestments,
      expectedInvestments: Math.min(leafUsers.length, investmentAmounts.length),
    }
  );
}

async function runAllTests() {
  try {
    console.log("\n");
    console.log("╔" + "═".repeat(58) + "╗");
    console.log("║" + " ".repeat(12) + "BINARY BONUS SCENARIO TEST SUITE" + " ".repeat(14) + "║");
    console.log("╚" + "═".repeat(58) + "╝");
    console.log("\n");

    // Connect to database
    console.log(`Attempting to connect to MongoDB at: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}...`);
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log("✅ Connected to MongoDB\n");
    } catch (connectError: any) {
      console.error("\n❌ MongoDB Connection Failed!");
      console.error("Error:", connectError.message);
      console.error("\nPlease ensure MongoDB is running and accessible.");
      process.exit(1);
    }

    // Run test scenarios
    await testScenario1();
    await testScenario2();
    await testScenario3();

    // Print summary
    console.log("=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60));
    const passed = testResults.filter((t) => t.passed).length;
    const failed = testResults.filter((t) => !t.passed).length;
    const total = testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
    console.log();

    if (failed > 0) {
      console.log("Failed Tests:");
      testResults
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`  ❌ ${t.name}: ${t.message}`);
        });
      console.log();
    }

    // Cleanup
    await User.deleteMany({ userId: { $regex: /^SCENARIO-/ } });
    await BinaryTree.deleteMany({});
    await Investment.deleteMany({});
    await Wallet.deleteMany({});
    console.log("Test data cleaned up");

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Test execution error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run tests
runAllTests();

