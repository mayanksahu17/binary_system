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
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import { addBusinessVolume } from "../services/investment.service";
import { checkAndAwardCareerLevels, getUserCareerProgress } from "../services/career-level.service";
import { initializeUser } from "../services/userInit.service";
import * as fs from "fs";
import * as path from "path";

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
const logFile = path.join(__dirname, "../../career-levels-test-results.log");
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

function writeLogFile(suite: TestSuite) {
  const logContent = `
================================================================================
CAREER LEVELS REWARD SYSTEM - COMPREHENSIVE TEST SUITE
================================================================================
Test Suite: ${suite.suiteName}
Start Time: ${new Date(suiteStartTime).toISOString()}
End Time: ${new Date().toISOString()}
Duration: ${(suite.duration / 1000).toFixed(2)} seconds

================================================================================
TEST SUMMARY
================================================================================
Total Tests: ${suite.totalTests}
✅ Passed: ${suite.passed}
❌ Failed: ${suite.failed}
⏭️  Skipped: ${suite.skipped}
Success Rate: ${((suite.passed / suite.totalTests) * 100).toFixed(2)}%

================================================================================
DETAILED TEST RESULTS
================================================================================

${suite.results.map((result, index) => `
[${index + 1}] ${result.testName}
    Status: ${result.status}
    Time: ${result.timestamp}
    Message: ${result.message}
    ${result.details ? `Details: ${JSON.stringify(result.details, null, 4)}` : ""}
`).join("\n")}

================================================================================
${suite.failed > 0 ? "FAILED TESTS" : "ALL TESTS PASSED"}
================================================================================
${suite.failed > 0 ? suite.results.filter(r => r.status === "FAIL").map(r => `- ${r.testName}: ${r.message}`).join("\n") : "✅ All tests passed successfully!"}

================================================================================
END OF TEST REPORT
================================================================================
`;

  fs.writeFileSync(logFile, logContent, "utf-8");
  console.log(`\n📄 Test results written to: ${logFile}`);
}

async function setupTestData() {
  console.log("Setting up test data...\n");

  // Clean up existing test data
  await User.deleteMany({ userId: { $regex: /^CAREER-TEST-/ } });
  const testUserIds = await User.find({ userId: { $regex: /^CAREER-TEST-/ } }).distinct("_id");
  await BinaryTree.deleteMany({ user: { $in: testUserIds } });
  await UserCareerProgress.deleteMany({ user: { $in: testUserIds } });
  await Wallet.deleteMany({ user: { $in: testUserIds } });
  await WalletTransaction.deleteMany({ user: { $in: testUserIds } });
  await Investment.deleteMany({ user: { $in: testUserIds } });

  // Create or get test package
  let testPackage = await Package.findOne({ packageName: "Career Test Package" });
  if (!testPackage) {
    testPackage = await Package.create({
      packageName: "Career Test Package",
      minAmount: Types.Decimal128.fromString("100"),
      maxAmount: Types.Decimal128.fromString("100000"),
      duration: 150,
      totalOutputPct: 225,
      renewablePrinciplePct: 50,
      referralPct: 7,
      binaryPct: 10,
      powerCapacity: Types.Decimal128.fromString("1000"),
      status: "Active",
    });
  }

  // Create default career levels if they don't exist
  const levels = [
    { name: "Bronze", level: 1, investmentThreshold: 1000, rewardAmount: 200 },
    { name: "Silver", level: 2, investmentThreshold: 5000, rewardAmount: 500 },
    { name: "Gold", level: 3, investmentThreshold: 10000, rewardAmount: 1000 },
    { name: "Platinum", level: 4, investmentThreshold: 20000, rewardAmount: 5000 },
  ];

  for (const levelData of levels) {
    const existing = await CareerLevel.findOne({ name: levelData.name });
    if (!existing) {
      await CareerLevel.create({
        name: levelData.name,
        level: levelData.level,
        investmentThreshold: Types.Decimal128.fromString(levelData.investmentThreshold.toString()),
        rewardAmount: Types.Decimal128.fromString(levelData.rewardAmount.toString()),
        status: "Active",
      });
    }
  }

  return { pkg: testPackage };
}

async function fundWallet(userId: Types.ObjectId, type: WalletType, amount: number) {
  let wallet = await Wallet.findOne({ user: userId, type });
  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      type,
      balance: Types.Decimal128.fromString("0"),
      renewablePrincipal: Types.Decimal128.fromString("0"),
      reserved: Types.Decimal128.fromString("0"),
      currency: "USD",
    });
  }
  const currentBalance = parseFloat(wallet.balance.toString());
  wallet.balance = Types.Decimal128.fromString((currentBalance + amount).toString());
  await wallet.save();
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

async function testScenario1_BasicLevelProgression() {
  console.log("=".repeat(60));
  console.log("SCENARIO 1: Basic Level Progression (Bronze -> Silver -> Gold -> Platinum)");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  // Create test user
  const user = await User.create({
    userId: "CAREER-TEST-001",
    name: "Career Test User 1",
    email: "career-test-1@test.com",
    phone: "1111111111",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);
  await fundWallet(user._id as Types.ObjectId, WalletType.INVESTMENT, 50000);

  // Test 1: Initial state - no level
  let progress = await getUserCareerProgress(user._id as Types.ObjectId);
  logTest(
    "Scenario 1.1 - Initial State",
    progress?.currentLevelName === "Bronze" || progress?.currentLevelName === null,
    `Current level should be Bronze or null, got: ${progress?.currentLevelName || "null"}`,
    { currentLevel: progress?.currentLevelName, levelInvestment: progress?.levelInvestment }
  );

  // Test 2: Add $1000 business (Bronze threshold)
  await addBusinessVolume(user._id as Types.ObjectId, 1000, "left");
  progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const walletAfterBronze = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const bronzeReward = walletAfterBronze ? parseFloat(walletAfterBronze.balance.toString()) : 0;

  logTest(
    "Scenario 1.2 - Bronze Level Completion",
    progress?.currentLevelName === "Silver" && Math.abs(bronzeReward - 200) < 0.01,
    `Should complete Bronze and receive $200, got: level=${progress?.currentLevelName}, reward=${bronzeReward.toFixed(2)}`,
    {
      currentLevel: progress?.currentLevelName,
      levelInvestment: progress?.levelInvestment,
      rewardReceived: bronzeReward,
      expectedReward: 200,
    }
  );

  // Test 3: Add $5000 more business (Silver threshold)
  await addBusinessVolume(user._id as Types.ObjectId, 5000, "right");
  progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const walletAfterSilver = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const silverReward = walletAfterSilver ? parseFloat(walletAfterSilver.balance.toString()) : 0;

  logTest(
    "Scenario 1.3 - Silver Level Completion",
    progress?.currentLevelName === "Gold" && Math.abs(silverReward - 700) < 0.01, // 200 + 500
    `Should complete Silver and receive $500, got: level=${progress?.currentLevelName}, totalReward=${silverReward.toFixed(2)}`,
    {
      currentLevel: progress?.currentLevelName,
      levelInvestment: progress?.levelInvestment,
      totalReward: silverReward,
      expectedTotalReward: 700,
    }
  );

  // Test 4: Add $10000 more business (Gold threshold)
  await addBusinessVolume(user._id as Types.ObjectId, 10000, "left");
  progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const walletAfterGold = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const goldReward = walletAfterGold ? parseFloat(walletAfterGold.balance.toString()) : 0;

  logTest(
    "Scenario 1.4 - Gold Level Completion",
    progress?.currentLevelName === "Platinum" && Math.abs(goldReward - 1700) < 0.01, // 200 + 500 + 1000
    `Should complete Gold and receive $1000, got: level=${progress?.currentLevelName}, totalReward=${goldReward.toFixed(2)}`,
    {
      currentLevel: progress?.currentLevelName,
      levelInvestment: progress?.levelInvestment,
      totalReward: goldReward,
      expectedTotalReward: 1700,
    }
  );

  // Test 5: Add $20000 more business (Platinum threshold)
  await addBusinessVolume(user._id as Types.ObjectId, 20000, "right");
  progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const walletAfterPlatinum = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const platinumReward = walletAfterPlatinum ? parseFloat(walletAfterPlatinum.balance.toString()) : 0;

  logTest(
    "Scenario 1.5 - Platinum Level Completion",
    progress?.currentLevelName === null && Math.abs(platinumReward - 6700) < 0.01, // 200 + 500 + 1000 + 5000
    `Should complete Platinum and receive $5000, got: level=${progress?.currentLevelName}, totalReward=${platinumReward.toFixed(2)}`,
    {
      currentLevel: progress?.currentLevelName,
      levelInvestment: progress?.levelInvestment,
      totalReward: platinumReward,
      expectedTotalReward: 6700,
      completedLevels: progress?.completedLevels.length,
    }
  );

  // Test 6: Verify completed levels count
  logTest(
    "Scenario 1.6 - Completed Levels Count",
    progress?.completedLevels.length === 4,
    `Should have 4 completed levels, got: ${progress?.completedLevels.length}`,
    {
      completedLevels: progress?.completedLevels.map((cl) => ({
        name: cl.levelName,
        reward: cl.rewardAmount,
      })),
    }
  );
}

async function testScenario2_ExactThreshold() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 2: Exact Threshold Matching");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-002",
    name: "Career Test User 2",
    email: "career-test-2@test.com",
    phone: "2222222222",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Add exactly $1000 (Bronze threshold)
  await addBusinessVolume(user._id as Types.ObjectId, 1000, "left");
  const progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const wallet = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const reward = wallet ? parseFloat(wallet.balance.toString()) : 0;

  logTest(
    "Scenario 2.1 - Exact Threshold Match",
    progress?.currentLevelName === "Silver" && Math.abs(reward - 200) < 0.01 && Math.abs(progress.levelInvestment - 0) < 0.01,
    `Should complete Bronze with exact $1000, got: level=${progress?.currentLevelName}, reward=${reward.toFixed(2)}, levelInvestment=${progress?.levelInvestment.toFixed(2)}`,
    {
      totalBusinessVolume: progress?.totalBusinessVolume,
      levelInvestment: progress?.levelInvestment,
      reward: reward,
    }
  );
}

async function testScenario3_OverThreshold() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 3: Over Threshold (Multiple Levels in One Go)");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-003",
    name: "Career Test User 3",
    email: "career-test-3@test.com",
    phone: "3333333333",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Add $15000 business (should complete Bronze + Silver + Gold)
  await addBusinessVolume(user._id as Types.ObjectId, 15000, "left");
  const progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const wallet = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const reward = wallet ? parseFloat(wallet.balance.toString()) : 0;

  logTest(
    "Scenario 3.1 - Multiple Levels in One Addition",
    progress?.currentLevelName === "Platinum" && Math.abs(reward - 1700) < 0.01, // 200 + 500 + 1000
    `Should complete Bronze, Silver, and Gold with $15000, got: level=${progress?.currentLevelName}, reward=${reward.toFixed(2)}`,
    {
      totalBusinessVolume: progress?.totalBusinessVolume,
      levelInvestment: progress?.levelInvestment,
      completedLevels: progress?.completedLevels.length,
      reward: reward,
    }
  );

  // Verify level investment is correct (should be $5000 towards Platinum)
  logTest(
    "Scenario 3.2 - Level Investment After Multiple Completions",
    Math.abs(progress.levelInvestment - 5000) < 0.01,
    `Level investment should be $5000 (towards Platinum), got: ${progress.levelInvestment.toFixed(2)}`,
    {
      levelInvestment: progress.levelInvestment,
      expected: 5000,
      calculation: "15000 - 1000 (Bronze) - 5000 (Silver) - 10000 (Gold) = 5000",
    }
  );
}

async function testScenario4_LevelInvestmentReset() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 4: Level Investment Reset After Completion");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-004",
    name: "Career Test User 4",
    email: "career-test-4@test.com",
    phone: "4444444444",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Add $1000 (complete Bronze)
  await addBusinessVolume(user._id as Types.ObjectId, 1000, "left");
  let progress = await getUserCareerProgress(user._id as Types.ObjectId);

  logTest(
    "Scenario 4.1 - Level Investment Reset After Bronze",
    Math.abs(progress.levelInvestment - 0) < 0.01,
    `Level investment should reset to 0 after Bronze completion, got: ${progress.levelInvestment.toFixed(2)}`,
    {
      levelInvestment: progress.levelInvestment,
      currentLevel: progress.currentLevelName,
    }
  );

  // Add $2000 more (should be $2000 towards Silver, not $3000)
  await addBusinessVolume(user._id as Types.ObjectId, 2000, "right");
  progress = await getUserCareerProgress(user._id as Types.ObjectId);

  logTest(
    "Scenario 4.2 - Level Investment Counts From Zero After Reset",
    Math.abs(progress.levelInvestment - 2000) < 0.01,
    `Level investment should be $2000 (not $3000), got: ${progress.levelInvestment.toFixed(2)}`,
    {
      levelInvestment: progress.levelInvestment,
      totalBusinessVolume: progress.totalBusinessVolume,
      expected: 2000,
    }
  );
}

async function testScenario5_LeftRightBusinessCombination() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 5: Left + Right Business Volume Combination");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-005",
    name: "Career Test User 5",
    email: "career-test-5@test.com",
    phone: "5555555555",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Add $600 to left
  await addBusinessVolume(user._id as Types.ObjectId, 600, "left");
  // Add $400 to right (total = $1000, should complete Bronze)
  await addBusinessVolume(user._id as Types.ObjectId, 400, "right");
  const progress = await getUserCareerProgress(user._id as Types.ObjectId);
  const wallet = await Wallet.findOne({ user: user._id as Types.ObjectId, type: WalletType.ROI });
  const reward = wallet ? parseFloat(wallet.balance.toString()) : 0;

  logTest(
    "Scenario 5.1 - Left + Right Business Combination",
    progress?.currentLevelName === "Silver" && Math.abs(reward - 200) < 0.01,
    `Should complete Bronze with $600 left + $400 right = $1000, got: level=${progress?.currentLevelName}, reward=${reward.toFixed(2)}`,
    {
      totalBusinessVolume: progress?.totalBusinessVolume,
      levelInvestment: progress?.levelInvestment,
      reward: reward,
    }
  );
}

async function testScenario6_TransactionRecords() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 6: Transaction Records for Career Rewards");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-006",
    name: "Career Test User 6",
    email: "career-test-6@test.com",
    phone: "6666666666",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Complete Bronze
  await addBusinessVolume(user._id as Types.ObjectId, 1000, "left");
  const transactions = await WalletTransaction.find({
    user: user._id as Types.ObjectId,
    "meta.type": "career_reward",
  }).lean();

  logTest(
    "Scenario 6.1 - Career Reward Transaction Created",
    transactions.length >= 1 && transactions.some((t) => t.meta?.levelName === "Bronze"),
    `Should have career reward transaction for Bronze, got: ${transactions.length} transactions`,
    {
      transactions: transactions.map((t) => ({
        type: t.meta?.type,
        levelName: t.meta?.levelName,
        amount: parseFloat(t.amount.toString()),
      })),
    }
  );

  // Complete Silver
  await addBusinessVolume(user._id as Types.ObjectId, 5000, "right");
  const allTransactions = await WalletTransaction.find({
    user: user._id as Types.ObjectId,
    "meta.type": "career_reward",
  }).lean();

  logTest(
    "Scenario 6.2 - Multiple Career Reward Transactions",
    allTransactions.length >= 2,
    `Should have transactions for Bronze and Silver, got: ${allTransactions.length} transactions`,
    {
      transactions: allTransactions.map((t) => ({
        levelName: t.meta?.levelName,
        amount: parseFloat(t.amount.toString()),
      })),
    }
  );
}

async function testScenario7_EdgeCases() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 7: Edge Cases");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  // Test 7.1: User with no business volume
  const user1 = await User.create({
    userId: "CAREER-TEST-007-1",
    name: "Career Test User 7-1",
    email: "career-test-7-1@test.com",
    phone: "7777777771",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user1._id as Types.ObjectId);
  let progress1 = await getUserCareerProgress(user1._id as Types.ObjectId);

  logTest(
    "Scenario 7.1 - User with No Business Volume",
    progress1?.currentLevelName === "Bronze" || progress1?.currentLevelName === null,
    `User with no business should have Bronze or null level, got: ${progress1?.currentLevelName || "null"}`,
    {
      totalBusinessVolume: progress1?.totalBusinessVolume,
      levelInvestment: progress1?.levelInvestment,
    }
  );

  // Test 7.2: Very small business volume increment
  await addBusinessVolume(user1._id as Types.ObjectId, 1, "left");
  progress1 = await getUserCareerProgress(user1._id as Types.ObjectId);

  logTest(
    "Scenario 7.2 - Small Business Volume Increment",
    progress1?.levelInvestment >= 1,
    `Level investment should increase by $1, got: ${progress1?.levelInvestment.toFixed(2)}`,
    {
      levelInvestment: progress1?.levelInvestment,
    }
  );

  // Test 7.3: User who completes all levels
  const user2 = await User.create({
    userId: "CAREER-TEST-007-2",
    name: "Career Test User 7-2",
    email: "career-test-7-2@test.com",
    phone: "7777777772",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user2._id as Types.ObjectId);
  await addBusinessVolume(user2._id as Types.ObjectId, 36000, "left"); // Complete all levels
  const progress2 = await getUserCareerProgress(user2._id as Types.ObjectId);

  logTest(
    "Scenario 7.3 - All Levels Completed",
    progress2?.currentLevelName === null && progress2?.completedLevels.length === 4,
    `User should have completed all 4 levels, got: currentLevel=${progress2?.currentLevelName}, completed=${progress2?.completedLevels.length}`,
    {
      currentLevel: progress2?.currentLevelName,
      completedLevels: progress2?.completedLevels.length,
      totalRewards: progress2?.totalRewardsEarned,
    }
  );
}

async function testScenario8_MultipleUsers() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 8: Multiple Users at Different Levels");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const users = [];
  for (let i = 1; i <= 5; i++) {
    const user = await User.create({
      userId: `CAREER-TEST-008-${i}`,
      name: `Career Test User 8-${i}`,
      email: `career-test-8-${i}@test.com`,
      phone: `888888888${i}`,
      password: "hashed",
      referrer: null,
      status: "active",
    });
    await initializeUser(user._id as Types.ObjectId);
    users.push(user);
  }

  // User 1: Bronze
  await addBusinessVolume(users[0]._id as Types.ObjectId, 1000, "left");
  // User 2: Silver
  await addBusinessVolume(users[1]._id as Types.ObjectId, 6000, "left");
  // User 3: Gold
  await addBusinessVolume(users[2]._id as Types.ObjectId, 16000, "left");
  // User 4: Platinum
  await addBusinessVolume(users[3]._id as Types.ObjectId, 36000, "left");
  // User 5: No level (below threshold)
  await addBusinessVolume(users[4]._id as Types.ObjectId, 500, "left");

  const progressResults = await Promise.all(
    users.map((user) => getUserCareerProgress(user._id as Types.ObjectId))
  );

  logTest(
    "Scenario 8.1 - Multiple Users at Different Levels",
    progressResults[0]?.currentLevelName === "Silver" &&
      progressResults[1]?.currentLevelName === "Gold" &&
      progressResults[2]?.currentLevelName === "Platinum" &&
      progressResults[3]?.currentLevelName === null &&
      (progressResults[4]?.currentLevelName === "Bronze" || progressResults[4]?.currentLevelName === null),
    `Users should be at different levels: User1=Silver, User2=Gold, User3=Platinum, User4=null, User5=Bronze/null`,
    {
      user1: progressResults[0]?.currentLevelName,
      user2: progressResults[1]?.currentLevelName,
      user3: progressResults[2]?.currentLevelName,
      user4: progressResults[3]?.currentLevelName,
      user5: progressResults[4]?.currentLevelName,
    }
  );
}

async function testScenario9_TotalRewardsTracking() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 9: Total Rewards Tracking");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  const user = await User.create({
    userId: "CAREER-TEST-009",
    name: "Career Test User 9",
    email: "career-test-9@test.com",
    phone: "9999999999",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Complete all levels
  await addBusinessVolume(user._id as Types.ObjectId, 36000, "left");
  const progress = await getUserCareerProgress(user._id as Types.ObjectId);

  const expectedTotalRewards = 200 + 500 + 1000 + 5000; // 6700

  logTest(
    "Scenario 9.1 - Total Rewards Calculation",
    Math.abs(progress.totalRewardsEarned - expectedTotalRewards) < 0.01,
    `Total rewards should be $${expectedTotalRewards}, got: $${progress.totalRewardsEarned.toFixed(2)}`,
    {
      totalRewardsEarned: progress.totalRewardsEarned,
      expected: expectedTotalRewards,
      completedLevels: progress.completedLevels.map((cl) => ({
        name: cl.levelName,
        reward: cl.rewardAmount,
      })),
    }
  );
}

async function testScenario10_LevelStatusInactive() {
  console.log("\n" + "=".repeat(60));
  console.log("SCENARIO 10: Inactive Career Levels");
  console.log("=".repeat(60));

  const { pkg } = await setupTestData();

  // Deactivate Silver level
  const silverLevel = await CareerLevel.findOne({ name: "Silver" });
  if (silverLevel) {
    silverLevel.status = "InActive";
    await silverLevel.save();
  }

  const user = await User.create({
    userId: "CAREER-TEST-010",
    name: "Career Test User 10",
    email: "career-test-10@test.com",
    phone: "1010101010",
    password: "hashed",
    referrer: null,
    status: "active",
  });

  await initializeUser(user._id as Types.ObjectId);

  // Complete Bronze
  await addBusinessVolume(user._id as Types.ObjectId, 1000, "left");
  let progress = await getUserCareerProgress(user._id as Types.ObjectId);

  logTest(
    "Scenario 10.1 - Skip Inactive Level",
    progress?.currentLevelName === "Gold", // Should skip Silver and go to Gold
    `Should skip inactive Silver level and go to Gold, got: ${progress?.currentLevelName}`,
    {
      currentLevel: progress?.currentLevelName,
      completedLevels: progress?.completedLevels.map((cl) => cl.levelName),
    }
  );

  // Reactivate Silver for other tests
  if (silverLevel) {
    silverLevel.status = "Active";
    await silverLevel.save();
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  suiteStartTime = Date.now();

  try {
    console.log("=".repeat(60));
    console.log("CAREER LEVELS REWARD SYSTEM - COMPREHENSIVE TEST SUITE");
    console.log("=".repeat(60));
    console.log(`Start Time: ${new Date().toISOString()}\n`);

    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Run all test scenarios
    await testScenario1_BasicLevelProgression();
    await testScenario2_ExactThreshold();
    await testScenario3_OverThreshold();
    await testScenario4_LevelInvestmentReset();
    await testScenario5_LeftRightBusinessCombination();
    await testScenario6_TransactionRecords();
    await testScenario7_EdgeCases();
    await testScenario8_MultipleUsers();
    await testScenario9_TotalRewardsTracking();
    await testScenario10_LevelStatusInactive();

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    // Calculate metrics
    const passed = testResults.filter((r) => r.status === "PASS").length;
    const failed = testResults.filter((r) => r.status === "FAIL").length;
    const skipped = testResults.filter((r) => r.status === "SKIP").length;
    const total = testResults.length;

    const suite: TestSuite = {
      suiteName: "Career Levels Reward System - Comprehensive Test Suite",
      totalTests: total,
      passed,
      failed,
      skipped,
      results: testResults,
      duration,
    };

    // Write log file
    writeLogFile(suite);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log("=".repeat(60));

    if (failed > 0) {
      console.log("\n❌ FAILED TESTS:");
      testResults
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.log(`  - ${r.testName}: ${r.message}`);
        });
    } else {
      console.log("\n✅ All tests passed successfully!");
    }

    console.log(`\n📄 Detailed test results written to: ${logFile}`);
  } catch (error: any) {
    console.error("❌ Test execution error:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run tests
runAllTests();

