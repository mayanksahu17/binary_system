/**
 * Comprehensive System Test Script - 20 Users with Complex Tree
 * 
 * This script:
 * 1. Creates 20 users in a complex tree structure
 * 2. Makes investments with varying amounts
 * 3. Calculates expected results for:
 *    - Referral bonuses (immediate, one-time)
 *    - Binary bonuses (daily, via cron)
 *    - ROI (daily, via cron, split renewable/cashable)
 *    - Career level rewards (triggered on business volume)
 * 4. Runs cron jobs
 * 5. Validates actual vs expected results
 * 6. Generates success metrics and logs failures
 * 
 * Usage: npm run test:comprehensive
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { CareerLevel } from "../models/CareerLevel";
import { UserCareerProgress } from "../models/UserCareerProgress";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";
import { processInvestment } from "../services/investment.service";
import { calculateDailyBinaryBonuses } from "../services/investment.service";
import { calculateDailyROI } from "../services/roi-cron.service";
import { getUserCareerProgress } from "../services/career-level.service";
import connectdb from "../db/index";
import { Types } from "mongoose";
import { WalletType } from "../models/types";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config({ path: "./.env" });

// Test results log file
const LOG_FILE = path.join(__dirname, "../../comprehensive-test-results.log");

interface ExpectedResults {
  userId: string;
  name: string;
  referralBonus: number;
  binaryBonus: number;
  roiCashable: number;
  roiRenewable: number;
  careerRewards: number;
  totalBusinessVolume: number;
  leftBusiness: number;
  rightBusiness: number;
  leftCarry: number;
  rightCarry: number;
  currentCareerLevel: string | null;
}

interface TestResult {
  userId: string;
  test: string;
  expected: number;
  actual: number;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];
const expectedResults: Map<string, ExpectedResults> = new Map();
const actualResults: Map<string, any> = new Map();

/**
 * Log to both console and file
 */
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + "\n");
}

/**
 * Log test result
 */
function logTestResult(result: TestResult) {
  testResults.push(result);
  const status = result.passed ? "✅ PASS" : "❌ FAIL";
  log(`${status} | ${result.userId} | ${result.test} | Expected: $${result.expected.toFixed(2)} | Actual: $${result.actual.toFixed(2)}${result.error ? ` | Error: ${result.error}` : ""}`);
}

/**
 * Flush database
 */
async function flushDatabase() {
  try {
    log("🗑️  Flushing database...");
    await User.deleteMany({});
    await BinaryTree.deleteMany({});
    await Package.deleteMany({});
    await Investment.deleteMany({});
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await CareerLevel.deleteMany({});
    await UserCareerProgress.deleteMany({});
    log("✅ Database flushed\n");
  } catch (error) {
    log(`❌ Error flushing database: ${error}`);
    throw error;
  }
}

/**
 * Create default career levels
 */
async function createCareerLevels() {
  try {
    log("📊 Creating career levels...");
    
    const levels = [
      { name: "Bronze", level: 1, threshold: 1000, reward: 200 },
      { name: "Silver", level: 2, threshold: 5000, reward: 500 },
      { name: "Gold", level: 3, threshold: 10000, reward: 1000 },
      { name: "Platinum", level: 4, threshold: 20000, reward: 5000 },
    ];

    for (const level of levels) {
      await CareerLevel.findOneAndUpdate(
        { name: level.name },
        {
          name: level.name,
          level: level.level,
          investmentThreshold: new Types.Decimal128(level.threshold.toString()),
          rewardAmount: new Types.Decimal128(level.reward.toString()),
          status: "Active",
        },
        { upsert: true, new: true }
      );
    }
    
    log("✅ Career levels created\n");
  } catch (error) {
    log(`❌ Error creating career levels: ${error}`);
    throw error;
  }
}

/**
 * Create test package
 */
async function createTestPackage() {
  try {
    log("📦 Creating test package...");
    
    const pkg = await Package.findOneAndUpdate(
      { packageName: "Test Package" },
      {
        packageName: "Test Package",
        roi: 225,
        totalOutputPct: 225,
        renewablePrinciplePct: 50,
        referralPct: 10,
        binaryPct: 10,
        powerCapacity: new Types.Decimal128("1000"),
        duration: 150,
        minAmount: new Types.Decimal128("100"),
        maxAmount: new Types.Decimal128("10000"),
        status: "Active",
      },
      { upsert: true, new: true }
    );
    
    log(`✅ Test package created: ${pkg._id}\n`);
    return pkg;
  } catch (error) {
    log(`❌ Error creating package: ${error}`);
    throw error;
  }
}

/**
 * Create 20 users in a complex tree structure
 * Tree structure:
 * Level 1: User1 (root)
 * Level 2: User2 (left), User3 (right)
 * Level 3: User4 (left of User2), User5 (right of User2), User6 (left of User3), User7 (right of User3)
 * Level 4: User8-11 (children of User4-7)
 * Level 5: User12-15 (children of User8-11)
 * Level 6: User16-20 (children of User12-15)
 */
async function createUsers() {
  try {
    log("👥 Creating 20 users in complex tree structure...");
    
    const users: { [key: string]: any } = {};
    
    // Create root user (User1)
    const user1 = await User.create({
      userId: await generateNextUserId(),
      name: "User1 (Root)",
      email: "user1@test.com",
      phone: "1000000001",
      password: "test123",
      referrer: null,
      position: null,
      status: "active",
    });
    await initializeUser(user1._id as Types.ObjectId, null, null);
    users["User1"] = user1;
    log(`✅ Created User1: ${user1.userId}`);
    
    // Level 2: User2 (left of User1), User3 (right of User1)
    const user2 = await User.create({
      userId: await generateNextUserId(),
      name: "User2",
      email: "user2@test.com",
      phone: "1000000002",
      password: "test123",
      referrer: user1._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user2._id as Types.ObjectId, user1._id as Types.ObjectId, "left");
    users["User2"] = user2;
    log(`✅ Created User2: ${user2.userId} (left of User1)`);
    
    const user3 = await User.create({
      userId: await generateNextUserId(),
      name: "User3",
      email: "user3@test.com",
      phone: "1000000003",
      password: "test123",
      referrer: user1._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user3._id as Types.ObjectId, user1._id as Types.ObjectId, "right");
    users["User3"] = user3;
    log(`✅ Created User3: ${user3.userId} (right of User1)`);
    
    // Level 3: User4-7
    const user4 = await User.create({
      userId: await generateNextUserId(),
      name: "User4",
      email: "user4@test.com",
      phone: "1000000004",
      password: "test123",
      referrer: user2._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user4._id as Types.ObjectId, user2._id as Types.ObjectId, "left");
    users["User4"] = user4;
    
    const user5 = await User.create({
      userId: await generateNextUserId(),
      name: "User5",
      email: "user5@test.com",
      phone: "1000000005",
      password: "test123",
      referrer: user2._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user5._id as Types.ObjectId, user2._id as Types.ObjectId, "right");
    users["User5"] = user5;
    
    const user6 = await User.create({
      userId: await generateNextUserId(),
      name: "User6",
      email: "user6@test.com",
      phone: "1000000006",
      password: "test123",
      referrer: user3._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user6._id as Types.ObjectId, user3._id as Types.ObjectId, "left");
    users["User6"] = user6;
    
    const user7 = await User.create({
      userId: await generateNextUserId(),
      name: "User7",
      email: "user7@test.com",
      phone: "1000000007",
      password: "test123",
      referrer: user3._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user7._id as Types.ObjectId, user3._id as Types.ObjectId, "right");
    users["User7"] = user7;
    
    // Level 4: User8-11
    const user8 = await User.create({
      userId: await generateNextUserId(),
      name: "User8",
      email: "user8@test.com",
      phone: "1000000008",
      password: "test123",
      referrer: user4._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user8._id as Types.ObjectId, user4._id as Types.ObjectId, "left");
    users["User8"] = user8;
    
    const user9 = await User.create({
      userId: await generateNextUserId(),
      name: "User9",
      email: "user9@test.com",
      phone: "1000000009",
      password: "test123",
      referrer: user5._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user9._id as Types.ObjectId, user5._id as Types.ObjectId, "left");
    users["User9"] = user9;
    
    const user10 = await User.create({
      userId: await generateNextUserId(),
      name: "User10",
      email: "user10@test.com",
      phone: "1000000010",
      password: "test123",
      referrer: user6._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user10._id as Types.ObjectId, user6._id as Types.ObjectId, "right");
    users["User10"] = user10;
    
    const user11 = await User.create({
      userId: await generateNextUserId(),
      name: "User11",
      email: "user11@test.com",
      phone: "1000000011",
      password: "test123",
      referrer: user7._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user11._id as Types.ObjectId, user7._id as Types.ObjectId, "right");
    users["User11"] = user11;
    
    // Level 5: User12-15
    const user12 = await User.create({
      userId: await generateNextUserId(),
      name: "User12",
      email: "user12@test.com",
      phone: "1000000012",
      password: "test123",
      referrer: user8._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user12._id as Types.ObjectId, user8._id as Types.ObjectId, "left");
    users["User12"] = user12;
    
    const user13 = await User.create({
      userId: await generateNextUserId(),
      name: "User13",
      email: "user13@test.com",
      phone: "1000000013",
      password: "test123",
      referrer: user9._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user13._id as Types.ObjectId, user9._id as Types.ObjectId, "right");
    users["User13"] = user13;
    
    const user14 = await User.create({
      userId: await generateNextUserId(),
      name: "User14",
      email: "user14@test.com",
      phone: "1000000014",
      password: "test123",
      referrer: user10._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user14._id as Types.ObjectId, user10._id as Types.ObjectId, "left");
    users["User14"] = user14;
    
    const user15 = await User.create({
      userId: await generateNextUserId(),
      name: "User15",
      email: "user15@test.com",
      phone: "1000000015",
      password: "test123",
      referrer: user11._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user15._id as Types.ObjectId, user11._id as Types.ObjectId, "right");
    users["User15"] = user15;
    
    // Level 6: User16-20
    const user16 = await User.create({
      userId: await generateNextUserId(),
      name: "User16",
      email: "user16@test.com",
      phone: "1000000016",
      password: "test123",
      referrer: user12._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user16._id as Types.ObjectId, user12._id as Types.ObjectId, "left");
    users["User16"] = user16;
    
    const user17 = await User.create({
      userId: await generateNextUserId(),
      name: "User17",
      email: "user17@test.com",
      phone: "1000000017",
      password: "test123",
      referrer: user12._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user17._id as Types.ObjectId, user12._id as Types.ObjectId, "right");
    users["User17"] = user17;
    
    const user18 = await User.create({
      userId: await generateNextUserId(),
      name: "User18",
      email: "user18@test.com",
      phone: "1000000018",
      password: "test123",
      referrer: user13._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user18._id as Types.ObjectId, user13._id as Types.ObjectId, "left");
    users["User18"] = user18;
    
    const user19 = await User.create({
      userId: await generateNextUserId(),
      name: "User19",
      email: "user19@test.com",
      phone: "1000000019",
      password: "test123",
      referrer: user14._id as Types.ObjectId,
      position: "right",
      status: "active",
    });
    await initializeUser(user19._id as Types.ObjectId, user14._id as Types.ObjectId, "right");
    users["User19"] = user19;
    
    const user20 = await User.create({
      userId: await generateNextUserId(),
      name: "User20",
      email: "user20@test.com",
      phone: "1000000020",
      password: "test123",
      referrer: user15._id as Types.ObjectId,
      position: "left",
      status: "active",
    });
    await initializeUser(user20._id as Types.ObjectId, user15._id as Types.ObjectId, "left");
    users["User20"] = user20;
    
    log("✅ All 20 users created\n");
    return users;
  } catch (error) {
    log(`❌ Error creating users: ${error}`);
    throw error;
  }
}

/**
 * Make investments with varying amounts
 * Investment amounts designed to test:
 * - Binary matching
 * - Carry forward
 * - Career level progression
 * - Multiple levels of referrals
 */
async function makeInvestments(users: { [key: string]: any }, pkg: any) {
  try {
    log("💰 Making investments...");
    
    // Investment plan:
    // User1 (root): $5000 - should get referral bonuses from User2, User3
    // User2: $1000 (left of User1)
    // User3: $5000 (right of User1) - should create binary match
    // User4: $800 (left of User2)
    // User5: $1200 (right of User2) - should create binary match for User2
    // User6: $3000 (left of User3)
    // User7: $2000 (right of User3) - should create binary match for User3
    // User8: $600 (left of User4)
    // User9: $400 (right of User5)
    // User10: $1500 (right of User6)
    // User11: $1000 (right of User7)
    // User12: $500 (left of User8)
    // User13: $700 (right of User9)
    // User14: $900 (left of User10)
    // User15: $1100 (right of User11)
    // User16: $300 (left of User12)
    // User17: $200 (right of User12)
    // User18: $400 (left of User13)
    // User19: $600 (right of User14)
    // User20: $800 (left of User15)
    
    const investments = [
      { user: "User1", amount: 5000 },
      { user: "User2", amount: 1000 },
      { user: "User3", amount: 5000 },
      { user: "User4", amount: 800 },
      { user: "User5", amount: 1200 },
      { user: "User6", amount: 3000 },
      { user: "User7", amount: 2000 },
      { user: "User8", amount: 600 },
      { user: "User9", amount: 400 },
      { user: "User10", amount: 1500 },
      { user: "User11", amount: 1000 },
      { user: "User12", amount: 500 },
      { user: "User13", amount: 700 },
      { user: "User14", amount: 900 },
      { user: "User15", amount: 1100 },
      { user: "User16", amount: 300 },
      { user: "User17", amount: 200 },
      { user: "User18", amount: 400 },
      { user: "User19", amount: 600 },
      { user: "User20", amount: 800 },
    ];
    
    for (const inv of investments) {
      const user = users[inv.user];
      if (!user) {
        log(`⚠️  User ${inv.user} not found, skipping investment`);
        continue;
      }
      
      try {
        await processInvestment(
          user._id as Types.ObjectId,
          pkg._id as Types.ObjectId,
          inv.amount,
          `test-payment-${inv.user}`
        );
        log(`✅ Investment: ${inv.user} - $${inv.amount}`);
      } catch (error: any) {
        log(`❌ Error investing for ${inv.user}: ${error.message}`);
      }
    }
    
    log("✅ All investments completed\n");
  } catch (error) {
    log(`❌ Error making investments: ${error}`);
    throw error;
  }
}

/**
 * Calculate expected results for all users
 */
async function calculateExpectedResults(users: { [key: string]: any }, pkg: any) {
  try {
    log("📊 Calculating expected results...");
    
    const referralPct = pkg.referralPct || 10;
    const binaryPct = pkg.binaryPct || 10;
    const powerCapacity = parseFloat(pkg.powerCapacity?.toString() || "1000");
    const totalOutputPct = pkg.totalOutputPct || 225;
    const durationDays = pkg.duration || 150;
    const renewablePct = pkg.renewablePrinciplePct || 50;
    const dailyRoiRate = (totalOutputPct / 100) / durationDays;
    
    // Investment amounts (from makeInvestments)
    const investments: { [key: string]: number } = {
      User1: 5000,
      User2: 1000,
      User3: 5000,
      User4: 800,
      User5: 1200,
      User6: 3000,
      User7: 2000,
      User8: 600,
      User9: 400,
      User10: 1500,
      User11: 1000,
      User12: 500,
      User13: 700,
      User14: 900,
      User15: 1100,
      User16: 300,
      User17: 200,
      User18: 400,
      User19: 600,
      User20: 800,
    };
    
    // Tree structure (who refers whom and position)
    const tree: { [key: string]: { left: string[]; right: string[] } } = {
      User1: { left: ["User2"], right: ["User3"] },
      User2: { left: ["User4"], right: ["User5"] },
      User3: { left: ["User6"], right: ["User7"] },
      User4: { left: ["User8"], right: [] },
      User5: { left: ["User9"], right: [] },
      User6: { left: [], right: ["User10"] },
      User7: { left: [], right: ["User11"] },
      User8: { left: ["User12"], right: [] },
      User9: { left: [], right: ["User13"] },
      User10: { left: ["User14"], right: [] },
      User11: { left: [], right: ["User15"] },
      User12: { left: ["User16"], right: ["User17"] },
      User13: { left: ["User18"], right: [] },
      User14: { left: [], right: ["User19"] },
      User15: { left: ["User20"], right: [] },
    };
    
    // Calculate business volume for each user (cumulative from downlines)
    const businessVolume: { [key: string]: { left: number; right: number } } = {};
    
    function calculateBV(userId: string): { left: number; right: number } {
      if (businessVolume[userId]) {
        return businessVolume[userId];
      }
      
      const userTree = tree[userId] || { left: [], right: [] };
      let leftBV = 0;
      let rightBV = 0;
      
      // Add direct downlines' investments
      for (const leftChild of userTree.left) {
        const childBV = calculateBV(leftChild);
        leftBV += investments[leftChild] || 0;
        leftBV += childBV.left + childBV.right; // All downline BV flows up
      }
      
      for (const rightChild of userTree.right) {
        const childBV = calculateBV(rightChild);
        rightBV += investments[rightChild] || 0;
        rightBV += childBV.left + childBV.right; // All downline BV flows up
      }
      
      businessVolume[userId] = { left: leftBV, right: rightBV };
      return businessVolume[userId];
    }
    
    // Calculate for all users
    for (const userId of Object.keys(users)) {
      calculateBV(userId);
    }
    
    // Calculate expected results for each user
    for (const [userId, user] of Object.entries(users)) {
      const userTree = tree[userId] || { left: [], right: [] };
      const bv = businessVolume[userId] || { left: 0, right: 0 };
      
      // Referral bonus: one-time payment for each direct referral's first investment
      let referralBonus = 0;
      for (const leftChild of userTree.left) {
        referralBonus += (investments[leftChild] || 0) * (referralPct / 100);
      }
      for (const rightChild of userTree.right) {
        referralBonus += (investments[rightChild] || 0) * (referralPct / 100);
      }
      
      // Binary bonus: min(left, right) * binaryPct, capped at powerCapacity
      // For first day, we need to calculate based on initial investments
      // leftAvailable = leftBV, rightAvailable = rightBV (no carry initially)
      const leftAvailable = bv.left;
      const rightAvailable = bv.right;
      const matched = Math.min(leftAvailable, rightAvailable);
      const cappedMatched = Math.min(matched, powerCapacity);
      const binaryBonus = cappedMatched * (binaryPct / 100);
      
      // Calculate carry forward
      let leftCarry = 0;
      let rightCarry = 0;
      if (leftAvailable > rightAvailable) {
        leftCarry = leftAvailable - rightAvailable;
      } else if (rightAvailable > leftAvailable) {
        rightCarry = rightAvailable - leftAvailable;
      }
      
      // ROI: Only for users who invested
      const userInvestment = investments[userId] || 0;
      const dailyRoiAmount = userInvestment * dailyRoiRate;
      const roiRenewable = dailyRoiAmount * (renewablePct / 100);
      const roiCashable = dailyRoiAmount - roiRenewable;
      
      // Career level: Based on total business volume (left + right)
      const totalBV = bv.left + bv.right;
      let careerRewards = 0;
      let currentLevel = null;
      
      if (totalBV >= 20000) {
        careerRewards = 200 + 500 + 1000 + 5000; // All levels
        currentLevel = null; // All completed
      } else if (totalBV >= 10000) {
        careerRewards = 200 + 500 + 1000; // Bronze, Silver, Gold
        currentLevel = "Platinum";
      } else if (totalBV >= 5000) {
        careerRewards = 200 + 500; // Bronze, Silver
        currentLevel = "Gold";
      } else if (totalBV >= 1000) {
        careerRewards = 200; // Bronze
        currentLevel = "Silver";
      } else {
        currentLevel = "Bronze";
      }
      
      expectedResults.set(userId, {
        userId: user.userId,
        name: user.name,
        referralBonus,
        binaryBonus,
        roiCashable,
        roiRenewable,
        careerRewards,
        totalBusinessVolume: totalBV,
        leftBusiness: bv.left,
        rightBusiness: bv.right,
        leftCarry,
        rightCarry,
        currentCareerLevel: currentLevel,
      });
    }
    
    log("✅ Expected results calculated\n");
  } catch (error) {
    log(`❌ Error calculating expected results: ${error}`);
    throw error;
  }
}

/**
 * Capture actual results from database
 */
async function captureActualResults(users: { [key: string]: any }) {
  try {
    log("📥 Capturing actual results from database...");
    
    for (const [key, user] of Object.entries(users)) {
      const userId = user._id as Types.ObjectId;
      
      // Get wallets
      const wallets = await Wallet.find({ user: userId }).lean();
      const referralWallet = wallets.find((w) => w.type === WalletType.REFERRAL);
      const binaryWallet = wallets.find((w) => w.type === WalletType.BINARY);
      const roiWallet = wallets.find((w) => w.type === WalletType.ROI);
      
      // Renewable principal is stored in the ROI wallet as a field, not a separate wallet
      const roiWalletWithRenewable = await Wallet.findOne({ user: userId, type: WalletType.ROI }).lean();
      
      // Get binary tree
      const tree = await BinaryTree.findOne({ user: userId }).lean();
      
      // Get career progress
      const careerProgress = await getUserCareerProgress(userId);
      
      // Get investments
      const investments = await Investment.find({ userId }).lean();
      const totalInvestment = investments.reduce((sum, inv) => {
        return sum + parseFloat(inv.investedAmount.toString());
      }, 0);
      
      actualResults.set(key, {
        userId: user.userId,
        referralBonus: referralWallet ? parseFloat(referralWallet.balance.toString()) : 0,
        binaryBonus: binaryWallet ? parseFloat(binaryWallet.balance.toString()) : 0,
        roiCashable: roiWallet ? parseFloat(roiWallet.balance.toString()) : 0,
        roiRenewable: roiWalletWithRenewable && roiWalletWithRenewable.renewablePrincipal 
          ? parseFloat(roiWalletWithRenewable.renewablePrincipal.toString()) 
          : 0,
        careerRewards: careerProgress?.totalRewardsEarned ? parseFloat(careerProgress.totalRewardsEarned.toString()) : 0,
        totalBusinessVolume: tree ? parseFloat(tree.leftBusiness.toString()) + parseFloat(tree.rightBusiness.toString()) : 0,
        leftBusiness: tree ? parseFloat(tree.leftBusiness.toString()) : 0,
        rightBusiness: tree ? parseFloat(tree.rightBusiness.toString()) : 0,
        leftCarry: tree ? parseFloat(tree.leftCarry.toString()) : 0,
        rightCarry: tree ? parseFloat(tree.rightCarry.toString()) : 0,
        currentCareerLevel: careerProgress?.currentLevelName || null,
        totalInvestment,
      });
    }
    
    log("✅ Actual results captured\n");
  } catch (error) {
    log(`❌ Error capturing actual results: ${error}`);
    throw error;
  }
}

/**
 * Validate results
 */
async function validateResults() {
  try {
    log("🔍 Validating results...\n");
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    
    for (const [key, expected] of expectedResults.entries()) {
      const actual = actualResults.get(key);
      if (!actual) {
        logTestResult({
          userId: expected.userId,
          test: "User Exists",
          expected: 1,
          actual: 0,
          passed: false,
          error: "User not found in actual results",
        });
        failedTests++;
        totalTests++;
        continue;
      }
      
      // Test referral bonus (allow small rounding differences)
      totalTests++;
      const referralDiff = Math.abs(expected.referralBonus - actual.referralBonus);
      logTestResult({
        userId: expected.userId,
        test: "Referral Bonus",
        expected: expected.referralBonus,
        actual: actual.referralBonus,
        passed: referralDiff < 0.01,
        error: referralDiff >= 0.01 ? `Difference: $${referralDiff.toFixed(2)}` : undefined,
      });
      if (referralDiff < 0.01) passedTests++; else failedTests++;
      
      // Test binary bonus
      totalTests++;
      const binaryDiff = Math.abs(expected.binaryBonus - actual.binaryBonus);
      logTestResult({
        userId: expected.userId,
        test: "Binary Bonus",
        expected: expected.binaryBonus,
        actual: actual.binaryBonus,
        passed: binaryDiff < 0.01,
        error: binaryDiff >= 0.01 ? `Difference: $${binaryDiff.toFixed(2)}` : undefined,
      });
      if (binaryDiff < 0.01) passedTests++; else failedTests++;
      
      // Test ROI cashable
      totalTests++;
      const roiCashableDiff = Math.abs(expected.roiCashable - actual.roiCashable);
      logTestResult({
        userId: expected.userId,
        test: "ROI Cashable",
        expected: expected.roiCashable,
        actual: actual.roiCashable,
        passed: roiCashableDiff < 0.01,
        error: roiCashableDiff >= 0.01 ? `Difference: $${roiCashableDiff.toFixed(2)}` : undefined,
      });
      if (roiCashableDiff < 0.01) passedTests++; else failedTests++;
      
      // Test ROI renewable
      totalTests++;
      const roiRenewableDiff = Math.abs(expected.roiRenewable - actual.roiRenewable);
      logTestResult({
        userId: expected.userId,
        test: "ROI Renewable",
        expected: expected.roiRenewable,
        actual: actual.roiRenewable,
        passed: roiRenewableDiff < 0.01,
        error: roiRenewableDiff >= 0.01 ? `Difference: $${roiRenewableDiff.toFixed(2)}` : undefined,
      });
      if (roiRenewableDiff < 0.01) passedTests++; else failedTests++;
      
      // Test career rewards
      totalTests++;
      const careerDiff = Math.abs(expected.careerRewards - actual.careerRewards);
      logTestResult({
        userId: expected.userId,
        test: "Career Rewards",
        expected: expected.careerRewards,
        actual: actual.careerRewards,
        passed: careerDiff < 0.01,
        error: careerDiff >= 0.01 ? `Difference: $${careerDiff.toFixed(2)}` : undefined,
      });
      if (careerDiff < 0.01) passedTests++; else failedTests++;
      
      // Test business volume
      totalTests++;
      const bvDiff = Math.abs(expected.totalBusinessVolume - actual.totalBusinessVolume);
      logTestResult({
        userId: expected.userId,
        test: "Total Business Volume",
        expected: expected.totalBusinessVolume,
        actual: actual.totalBusinessVolume,
        passed: bvDiff < 0.01,
        error: bvDiff >= 0.01 ? `Difference: $${bvDiff.toFixed(2)}` : undefined,
      });
      if (bvDiff < 0.01) passedTests++; else failedTests++;
    }
    
    // Generate summary
    log("\n" + "=".repeat(80));
    log("📊 TEST SUMMARY");
    log("=".repeat(80));
    log(`Total Tests: ${totalTests}`);
    log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(2)}%)`);
    log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(2)}%)`);
    log("=".repeat(80) + "\n");
    
    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: (passedTests / totalTests) * 100,
    };
  } catch (error) {
    log(`❌ Error validating results: ${error}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTest() {
  try {
    // Clear log file
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
    
    log("=".repeat(80));
    log("🚀 COMPREHENSIVE SYSTEM TEST - 20 USERS");
    log("=".repeat(80));
    log("");
    
    // Connect to database
    await connectdb();
    log("✅ Connected to database\n");
    
    // Step 1: Flush database
    await flushDatabase();
    
    // Step 2: Create career levels
    await createCareerLevels();
    
    // Step 3: Create test package
    const pkg = await createTestPackage();
    
    // Step 4: Create users
    const users = await createUsers();
    
    // Step 5: Make investments
    await makeInvestments(users, pkg);
    
    // Step 6: Capture results BEFORE cron (should have referral bonuses only)
    log("📸 Capturing results BEFORE cron job...");
    await captureActualResults(users);
    log("✅ Results captured (BEFORE cron)\n");
    
    // Step 7: Calculate expected results
    await calculateExpectedResults(users, pkg);
    
    // Step 8: Run cron jobs (Binary + ROI)
    log("⏰ Running cron jobs (Binary + ROI)...");
    await calculateDailyBinaryBonuses();
    await calculateDailyROI();
    log("✅ Cron jobs completed\n");
    
    // Step 9: Capture results AFTER cron
    log("📸 Capturing results AFTER cron job...");
    await captureActualResults(users);
    log("✅ Results captured (AFTER cron)\n");
    
    // Step 10: Validate results
    const summary = await validateResults();
    
    // Final summary
    log("\n" + "=".repeat(80));
    log("🎯 FINAL SUMMARY");
    log("=".repeat(80));
    log(`Success Rate: ${summary.successRate.toFixed(2)}%`);
    log(`Total Tests: ${summary.total}`);
    log(`Passed: ${summary.passed}`);
    log(`Failed: ${summary.failed}`);
    log("=".repeat(80));
    log(`\n📄 Full log saved to: ${LOG_FILE}\n`);
    
    // Close database connection
    await mongoose.connection.close();
    log("✅ Database connection closed");
    
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error) {
    log(`❌ Fatal error: ${error}`);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the test
runTest();

