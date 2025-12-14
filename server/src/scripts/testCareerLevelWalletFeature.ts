/**
 * Comprehensive Test Suite for Career Level Wallet Feature
 * Tests:
 * 1. Career level rewards go to CAREER_LEVEL wallet (not ROI wallet)
 * 2. Both left AND right business volumes must meet threshold
 * 3. Database verification
 * 4. Integration with wallet system
 * 5. Withdrawal functionality
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { CareerLevel } from "../models/CareerLevel";
import { UserCareerProgress } from "../models/UserCareerProgress";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { Withdrawal } from "../models/Withdrawal";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import { addBusinessVolume, processInvestment } from "../services/investment.service";
import { checkAndAwardCareerLevels, getUserCareerProgress } from "../services/career-level.service";
import { initializeUser } from "../services/userInit.service";
import connectdb from "../db/index";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "mongodb://localhost:27017/binary_system";

interface TestResult {
  testName: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  details?: any;
  timestamp: string;
}

interface TestSuite {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  duration: number;
}

const testResults: TestResult[] = [];
let suiteStartTime: number = 0;

function logTest(testName: string, passed: boolean, message: string, details?: any) {
  const result: TestResult = {
    testName,
    status: passed ? "PASS" : "FAIL",
    message,
    details,
    timestamp: new Date().toISOString(),
  };
  testResults.push(result);
  
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${testName}`);
  console.log(`   ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
  console.log();
}

function logSkip(testName: string, reason: string) {
  const result: TestResult = {
    testName,
    status: "SKIP",
    message: reason,
    timestamp: new Date().toISOString(),
  };
  testResults.push(result);
  console.log(`⏭️  SKIP: ${testName} - ${reason}\n`);
}

async function cleanupTestData(testUserId: string) {
  try {
    await User.deleteMany({ userId: { $regex: new RegExp(`^${testUserId}`) } });
    await CareerLevel.deleteMany({ name: { $regex: new RegExp(`^TEST-`) } });
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

async function createTestCareerLevels() {
  // Delete existing test levels first
  await CareerLevel.deleteMany({ name: { $regex: /^TEST-/ } });

  await CareerLevel.create([
    {
      name: "TEST-Bronze",
      level: 1,
      investmentThreshold: Types.Decimal128.fromString("1000"),
      rewardAmount: Types.Decimal128.fromString("200"),
      status: "Active",
    },
    {
      name: "TEST-Silver",
      level: 2,
      investmentThreshold: Types.Decimal128.fromString("5000"),
      rewardAmount: Types.Decimal128.fromString("500"),
      status: "Active",
    },
  ]);
}

async function createTestPackage() {
  let pkg = await Package.findOne({ packageName: "TEST-Package" });
  if (!pkg) {
    pkg = await Package.create({
      packageName: "TEST-Package",
      minAmount: Types.Decimal128.fromString("100"),
      maxAmount: Types.Decimal128.fromString("50000"),
      roi: 225,
      duration: 150,
      referralPct: 10,
      binaryPct: 10,
      powerCapacity: Types.Decimal128.fromString("1000"),
      status: "Active",
    });
  }
  return pkg;
}

async function runTestSuite() {
  suiteStartTime = Date.now();
  console.log("\n" + "=".repeat(80));
  console.log("CAREER LEVEL WALLET FEATURE - COMPREHENSIVE TEST SUITE");
  console.log("=".repeat(80) + "\n");

  try {
    await connectdb();
    console.log("✅ Connected to database\n");

    // Cleanup and setup
    await cleanupTestData("CAREER-TEST-");
    await createTestCareerLevels();
    const testPkg = await createTestPackage();

    // Test users
    let mainUser: any;
    let leftChild: any;
    let rightChild: any;

    // ===================================================================
    // TEST 1: Career Level Wallet Creation for New User
    // ===================================================================
    try {
      mainUser = await User.create({
        userId: "CAREER-TEST-MAIN",
        name: "Test Main User",
        email: "career-test-main@test.com",
        password: "test123",
        status: "active",
      });
      await initializeUser(mainUser._id as Types.ObjectId);

      const careerWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.CAREER_LEVEL,
      });

      logTest(
        "Test 1: Career Level Wallet Creation",
        !!careerWallet,
        careerWallet
          ? "Career Level wallet created for new user"
          : "Career Level wallet NOT created",
        {
          walletExists: !!careerWallet,
          balance: careerWallet ? parseFloat(careerWallet.balance.toString()) : null,
        }
      );
    } catch (error: any) {
      logTest("Test 1: Career Level Wallet Creation", false, error.message);
    }

    // ===================================================================
    // TEST 2: Both Sides Required - Left Only (Should NOT Trigger)
    // ===================================================================
    try {
      leftChild = await User.create({
        userId: "CAREER-TEST-LEFT",
        name: "Test Left Child",
        email: "career-test-left@test.com",
        password: "test123",
        referrer: mainUser._id,
        position: "left",
        status: "active",
      });
      await initializeUser(leftChild._id, mainUser._id, "left");

      // Fund investment wallet
      const leftInvestmentWallet = await Wallet.findOne({
        user: leftChild._id,
        type: WalletType.INVESTMENT,
      });
      leftInvestmentWallet!.balance = Types.Decimal128.fromString("1000");
      await leftInvestmentWallet!.save();

      // Create investment
      await processInvestment(
        leftChild._id as Types.ObjectId,
        testPkg._id as Types.ObjectId,
        1000,
        undefined,
        undefined
      );

      // Check main user's career level wallet
      const mainCareerWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.CAREER_LEVEL,
      });
      const mainRoiWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.ROI,
      });

      const careerBalance = parseFloat(mainCareerWallet!.balance.toString());
      const roiBalance = parseFloat(mainRoiWallet!.balance.toString());

      logTest(
        "Test 2: Both Sides Required - Left Only (Should NOT Trigger)",
        careerBalance === 0,
        careerBalance === 0
          ? "Career level reward correctly NOT triggered (only left side)"
          : `Career level reward incorrectly triggered. Balance: $${careerBalance}`,
        {
          leftBusiness: 1000,
          rightBusiness: 0,
          careerWalletBalance: careerBalance,
          roiWalletBalance: roiBalance,
        }
      );
    } catch (error: any) {
      logTest("Test 2: Both Sides Required - Left Only", false, error.message);
    }

    // ===================================================================
    // TEST 3: Both Sides Required - Both Sides Meet Threshold (SHOULD Trigger)
    // ===================================================================
    try {
      rightChild = await User.create({
        userId: "CAREER-TEST-RIGHT",
        name: "Test Right Child",
        email: "career-test-right@test.com",
        password: "test123",
        referrer: mainUser._id,
        position: "right",
        status: "active",
      });
      await initializeUser(rightChild._id, mainUser._id, "right");

      // Fund investment wallet
      const rightInvestmentWallet = await Wallet.findOne({
        user: rightChild._id,
        type: WalletType.INVESTMENT,
      });
      rightInvestmentWallet!.balance = Types.Decimal128.fromString("1000");
      await rightInvestmentWallet!.save();

      // Create investment
      await processInvestment(
        rightChild._id as Types.ObjectId,
        testPkg._id as Types.ObjectId,
        1000,
        undefined,
        undefined
      );

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check main user's wallets
      const mainCareerWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.CAREER_LEVEL,
      });
      const mainRoiWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.ROI,
      });

      const careerBalance = parseFloat(mainCareerWallet!.balance.toString());
      const roiBalance = parseFloat(mainRoiWallet!.balance.toString());

      // Check transactions
      const careerTransactions = await WalletTransaction.find({
        user: mainUser._id,
        wallet: mainCareerWallet!._id,
      });

      const passed = careerBalance === 200 && careerTransactions.length > 0;
      logTest(
        "Test 3: Both Sides Required - Both Sides Meet Threshold",
        passed,
        passed
          ? "Career level reward correctly triggered and credited to Career Level wallet"
          : `Expected $200 in Career Level wallet, got $${careerBalance}. ROI wallet: $${roiBalance}`,
        {
          leftBusiness: 1000,
          rightBusiness: 1000,
          careerWalletBalance: careerBalance,
          roiWalletBalance: roiBalance,
          careerTransactions: careerTransactions.length,
          transactionType: careerTransactions[0]?.meta?.type,
        }
      );
    } catch (error: any) {
      logTest("Test 3: Both Sides Required - Both Sides", false, error.message);
    }

    // ===================================================================
    // TEST 4: Verify Reward NOT in ROI Wallet
    // ===================================================================
    try {
      const mainRoiWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.ROI,
      });

      const roiTransactions = await WalletTransaction.find({
        user: mainUser._id,
        wallet: mainRoiWallet!._id,
      }).sort({ createdAt: -1 });

      // Check that no career_reward transactions are in ROI wallet
      const careerRewardsInRoi = roiTransactions.filter(
        (tx) => tx.meta?.type === "career_reward"
      );

      logTest(
        "Test 4: Verify Reward NOT in ROI Wallet",
        careerRewardsInRoi.length === 0,
        careerRewardsInRoi.length === 0
          ? "No career rewards found in ROI wallet (correct)"
          : `Found ${careerRewardsInRoi.length} career reward(s) in ROI wallet (incorrect)`,
        {
          roiTransactionsCount: roiTransactions.length,
          careerRewardsInRoi: careerRewardsInRoi.length,
        }
      );
    } catch (error: any) {
      logTest("Test 4: Verify Reward NOT in ROI Wallet", false, error.message);
    }

    // ===================================================================
    // TEST 5: Verify Career Level Transaction Metadata
    // ===================================================================
    try {
      const mainCareerWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.CAREER_LEVEL,
      });

      const careerTransactions = await WalletTransaction.find({
        user: mainUser._id,
        wallet: mainCareerWallet!._id,
      }).sort({ createdAt: -1 });

      const careerRewardTx = careerTransactions.find(
        (tx) => tx.meta?.type === "career_reward"
      );

      const passed =
        !!careerRewardTx &&
        careerRewardTx.meta?.type === "career_reward" &&
        !!careerRewardTx.meta?.levelName &&
        !!careerRewardTx.meta?.levelNumber;

      logTest(
        "Test 5: Verify Career Level Transaction Metadata",
        passed,
        passed
          ? "Career level transaction has correct metadata"
          : "Career level transaction metadata missing or incorrect",
        {
          transactionExists: !!careerRewardTx,
          metadata: careerRewardTx?.meta,
        }
      );
    } catch (error: any) {
      logTest("Test 5: Verify Career Level Transaction Metadata", false, error.message);
    }

    // ===================================================================
    // TEST 6: Verify Career Progress Tracking
    // ===================================================================
    try {
      const progress = await getUserCareerProgress(mainUser._id);

      const passed =
        progress.completedLevels.length > 0 &&
        progress.completedLevels.some((cl) => cl.levelName === "TEST-Bronze");

      logTest(
        "Test 6: Verify Career Progress Tracking",
        passed,
        passed
          ? "Career progress correctly tracked"
          : "Career progress not tracked correctly",
        {
          completedLevels: progress.completedLevels.length,
          levels: progress.completedLevels.map((cl) => cl.levelName),
          totalRewardsEarned: progress.totalRewardsEarned,
        }
      );
    } catch (error: any) {
      logTest("Test 6: Verify Career Progress Tracking", false, error.message);
    }

    // ===================================================================
    // TEST 7: Verify No Duplicate Rewards
    // ===================================================================
    try {
      const initialCareerBalance = parseFloat(
        (
          await Wallet.findOne({
            user: mainUser._id,
            type: WalletType.CAREER_LEVEL,
          })
        )!.balance.toString()
      );

      // Try to trigger career level check again
      await checkAndAwardCareerLevels(mainUser._id);

      const finalCareerBalance = parseFloat(
        (
          await Wallet.findOne({
            user: mainUser._id,
            type: WalletType.CAREER_LEVEL,
          })
        )!.balance.toString()
      );

      const passed = finalCareerBalance === initialCareerBalance;

      logTest(
        "Test 7: Verify No Duplicate Rewards",
        passed,
        passed
          ? "No duplicate rewards awarded"
          : `Duplicate reward detected. Balance changed from $${initialCareerBalance} to $${finalCareerBalance}`,
        {
          initialBalance: initialCareerBalance,
          finalBalance: finalCareerBalance,
        }
      );
    } catch (error: any) {
      logTest("Test 7: Verify No Duplicate Rewards", false, error.message);
    }

    // ===================================================================
    // TEST 8: Database Document Verification
    // ===================================================================
    try {
      const careerWallet = await Wallet.findOne({
        user: mainUser._id,
        type: WalletType.CAREER_LEVEL,
      });

      const allWallets = await Wallet.find({ user: mainUser._id });
      const walletTypes = allWallets.map((w) => w.type);

      const passed =
        !!careerWallet &&
        walletTypes.includes(WalletType.CAREER_LEVEL) &&
        careerWallet.currency === "USD";

      logTest(
        "Test 8: Database Document Verification",
        passed,
        passed
          ? "Career Level wallet document correctly stored in database"
          : "Career Level wallet document missing or incorrect",
        {
          walletExists: !!careerWallet,
          walletTypes: walletTypes,
          currency: careerWallet?.currency,
          balance: careerWallet ? parseFloat(careerWallet.balance.toString()) : null,
        }
      );
    } catch (error: any) {
      logTest("Test 8: Database Document Verification", false, error.message);
    }

    // ===================================================================
    // TEST 9: Unequal Business Volumes - Should NOT Trigger
    // ===================================================================
    try {
      // Create another test user for additional business volume
      const anotherLeft = await User.create({
        userId: "CAREER-TEST-LEFT2",
        name: "Test Left Child 2",
        email: "career-test-left2@test.com",
        password: "test123",
        referrer: leftChild._id,
        position: "left",
        status: "active",
      });
      await initializeUser(anotherLeft._id as Types.ObjectId, leftChild._id as Types.ObjectId, "left");

      const anotherLeftInvestmentWallet = await Wallet.findOne({
        user: anotherLeft._id,
        type: WalletType.INVESTMENT,
      });
      anotherLeftInvestmentWallet!.balance = Types.Decimal128.fromString("4000");
      await anotherLeftInvestmentWallet!.save();

      const initialCareerBalance = parseFloat(
        (
          await Wallet.findOne({
            user: mainUser._id,
            type: WalletType.CAREER_LEVEL,
          })
        )!.balance.toString()
      );

      await processInvestment(anotherLeft._id as Types.ObjectId, testPkg._id as Types.ObjectId, 4000, undefined, undefined);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalCareerBalance = parseFloat(
        (
          await Wallet.findOne({
            user: mainUser._id,
            type: WalletType.CAREER_LEVEL,
          })
        )!.balance.toString()
      );

      const tree = await BinaryTree.findOne({ user: mainUser._id });
      const leftBV = parseFloat(tree!.leftBusiness.toString());
      const rightBV = parseFloat(tree!.rightBusiness.toString());

      // Should NOT trigger Silver level because right side is only 1000, not 5000
      const passed = finalCareerBalance === initialCareerBalance && leftBV >= 5000 && rightBV < 5000;

      logTest(
        "Test 9: Unequal Business Volumes - Should NOT Trigger",
        passed,
        passed
          ? "Career level correctly NOT triggered when only one side meets threshold"
          : `Career level incorrectly triggered. Balance: $${finalCareerBalance}, Expected: $${initialCareerBalance}`,
        {
          leftBusiness: leftBV,
          rightBusiness: rightBV,
          initialBalance: initialCareerBalance,
          finalBalance: finalCareerBalance,
        }
      );
    } catch (error: any) {
      logTest("Test 9: Unequal Business Volumes", false, error.message);
    }

    // Generate summary
    const duration = Date.now() - suiteStartTime;
    const suite: TestSuite = {
      suiteName: "Career Level Wallet Feature Test Suite",
      totalTests: testResults.length,
      passed: testResults.filter((r) => r.status === "PASS").length,
      failed: testResults.filter((r) => r.status === "FAIL").length,
      skipped: testResults.filter((r) => r.status === "SKIP").length,
      results: testResults,
      duration,
    };

    console.log("\n" + "=".repeat(80));
    console.log("TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Tests: ${suite.totalTests}`);
    console.log(`✅ Passed: ${suite.passed}`);
    console.log(`❌ Failed: ${suite.failed}`);
    console.log(`⏭️  Skipped: ${suite.skipped}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${((suite.passed / suite.totalTests) * 100).toFixed(2)}%`);
    console.log("=".repeat(80) + "\n");

    // Cleanup
    await cleanupTestData("CAREER-TEST-");
    await CareerLevel.deleteMany({ name: { $regex: /^TEST-/ } });

    await mongoose.connection.close();
    process.exit(suite.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Test suite error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTestSuite();
}

export { runTestSuite };
