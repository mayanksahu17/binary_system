/**
 * API Test Suite: Voucher System Verification
 * 
 * Comprehensive API-level tests for voucher features and fixes:
 * 1. Voucher creation (from wallet, gateway disabled, by admin)
 * 2. Voucher usage in investments (full coverage, partial coverage)
 * 3. Voucher validation (expiry, status, ownership)
 * 4. Voucher listing and filtering
 * 5. Edge cases and bug fixes
 * 
 * Usage: npm run test:voucher-api
 * Or: npx ts-node -r dotenv/config src/scripts/testVoucherAPI.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { User } from "../models/User";
import { Voucher } from "../models/Voucher";
import { Investment } from "../models/Investment";
import { Package } from "../models/Package";
import { Wallet } from "../models/Wallet";
import { Payment } from "../models/Payment";
import { WalletType } from "../models/types";
import { Types } from "mongoose";
import { initializeUser } from "../services/userInit.service";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "mongodb://localhost:27017/binary_system";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000/api/v1";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
  error?: string;
}

const testResults: TestResult[] = [];
const LOG_FILE = path.join(__dirname, "../../voucher-api-test-results.log");

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + "\n");
}

function logTest(name: string, passed: boolean, message: string, details?: any, error?: string) {
  testResults.push({ name, passed, message, details, error });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  log(`${status}: ${name}`);
  log(`   ${message}`);
  if (error) {
    log(`   Error: ${error}`);
  }
  if (details) {
    log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
  log("");
}

// Helper function to get auth token
async function getAuthToken(userId: string, password: string = "test123"): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      userId,
      password,
    });
    if (response.data.status === "success" && response.data.data.token) {
      return response.data.data.token;
    }
    throw new Error("Token not found in response");
  } catch (error: any) {
    if (error.response) {
      log(`Login failed for ${userId}: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else {
      log(`Login error for ${userId}: ${error.message}`);
    }
    throw error;
  }
}

// Helper function to get admin token
async function getAdminToken(): Promise<string> {
  try {
    // Admin login requires email, not userId
    // First, try to find admin by userId and get email from database
    const { Admin } = await import("../models/Admin");
    const admin = await Admin.findOne({ userId: "CROWN-000000" });
    
    if (!admin) {
      throw new Error("Admin user CROWN-000000 not found in database");
    }
    
    const response = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: admin.email,
      password: "admin@123",
    });
    
    if (response.data.status === "success" && response.data.data.token) {
      return response.data.data.token;
    }
    throw new Error("Token not found in response");
  } catch (error: any) {
    // If that fails, try default email
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        email: "admin@cneox.com",
        password: "admin@123",
      });
      if (response.data.status === "success" && response.data.data.token) {
        return response.data.data.token;
      }
    } catch (innerError: any) {
      // Ignore inner error
    }
    throw new Error(`Failed to get admin token: ${error.response?.data?.message || error.message}`);
  }
}

async function setupTestData() {
  log("Setting up test data...");

  // Clean up existing test data
  await User.deleteMany({ userId: { $regex: /^VOUCHER-TEST-/ } });
  const testUsers = await User.find({ userId: { $regex: /^VOUCHER-TEST-/ } });
  const testUserIds = testUsers.map(u => u._id);
  await Voucher.deleteMany({ user: { $in: testUserIds } });
  await Investment.deleteMany({ user: { $in: testUserIds } });
  await Wallet.deleteMany({ user: { $in: testUserIds } });
  await Payment.deleteMany({ user: { $in: testUserIds } });

  // Create test users - password will be hashed by User model pre-save hook
  const user1 = await User.create({
    userId: "VOUCHER-TEST-1",
    name: "Test User 1",
    email: "voucher-test-1@test.com",
    phone: "1111111111",
    password: "test123", // Will be hashed automatically by pre-save hook
    referrer: null,
    status: "active",
  });

  const user2 = await User.create({
    userId: "VOUCHER-TEST-2",
    name: "Test User 2",
    email: "voucher-test-2@test.com",
    phone: "2222222222",
    password: "test123", // Will be hashed automatically by pre-save hook
    referrer: user1._id,
    position: "left",
    status: "active",
  });

  // Initialize binary trees (this also creates wallets)
  await initializeUser(user1._id as Types.ObjectId);
  await initializeUser(user2._id as Types.ObjectId, user1._id as Types.ObjectId, "left");

  // Ensure wallets exist and have balance for user1
  let roiWallet = await Wallet.findOne({ user: user1._id, type: WalletType.ROI });
  if (!roiWallet) {
    roiWallet = await Wallet.create({
      user: user1._id,
      type: WalletType.ROI,
      balance: Types.Decimal128.fromString("10000"),
      currency: "USD",
    });
  } else {
    roiWallet.balance = Types.Decimal128.fromString("10000");
    await roiWallet.save();
  }
  
  // Ensure other wallets exist too
  const walletTypes = [WalletType.REFERRAL, WalletType.BINARY, WalletType.INVESTMENT];
  for (const walletType of walletTypes) {
    let wallet = await Wallet.findOne({ user: user1._id, type: walletType });
    if (!wallet) {
      await Wallet.create({
        user: user1._id,
        type: walletType,
        balance: Types.Decimal128.fromString("0"),
        currency: "USD",
      });
    }
  }

  // Create or get a test package
  let testPackage = await Package.findOne({ packageName: "Voucher Test Package" });
  if (!testPackage) {
    testPackage = await Package.create({
      packageName: "Voucher Test Package",
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

  return { user1, user2, testPackage };
}

// Test 1: Create voucher from wallet
async function testCreateVoucherFromWallet() {
  log("=".repeat(60));
  log("TEST 1: Create Voucher from Wallet");
  log("=".repeat(60));

  try {
    const { user1 } = await setupTestData();
    // Wait a bit for user to be fully saved
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    const response = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      {
        amount: 100,
        fromWalletType: "ROI",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.status === "success" && response.data.data.voucher) {
      const voucher = response.data.data.voucher;
      const expectedInvestmentValue = 100 * 2; // 2x multiplier

      const passed =
        voucher.amount === 100 &&
        voucher.investmentValue === expectedInvestmentValue &&
        voucher.status === "active" &&
        voucher.multiplier === 2;

      logTest(
        "Create Voucher from Wallet",
        passed,
        passed
          ? `Voucher created successfully: ${voucher.voucherId}`
          : `Voucher creation failed or incorrect values`,
        {
          voucherId: voucher.voucherId,
          amount: voucher.amount,
          investmentValue: voucher.investmentValue,
          expectedInvestmentValue,
          status: voucher.status,
        }
      );

      return voucher;
    } else {
      logTest("Create Voucher from Wallet", false, "API returned error", response.data);
      return null;
    }
  } catch (error: any) {
    const errorDetails = error.response?.data || { message: error.message };
    const statusCode = error.response?.status || 'N/A';
    logTest(
      "Create Voucher from Wallet",
      false,
      `Exception occurred (Status: ${statusCode})`,
      errorDetails,
      error.message
    );
    return null;
  }
}

// Test 2: Create voucher when gateway is disabled
async function testCreateVoucherGatewayDisabled() {
  log("=".repeat(60));
  log("TEST 2: Create Voucher (Gateway Disabled)");
  log("=".repeat(60));

  try {
    const { user1 } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    const response = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      {
        amount: 150,
        // No fromWalletType - should create directly when gateway is disabled
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.status === "success" && response.data.data.voucher) {
      const voucher = response.data.data.voucher;
      const expectedInvestmentValue = 150 * 2;

      const passed =
        voucher.amount === 150 &&
        voucher.investmentValue === expectedInvestmentValue &&
        voucher.status === "active";

      logTest(
        "Create Voucher (Gateway Disabled)",
        passed,
        passed
          ? `Voucher created successfully without payment: ${voucher.voucherId}`
          : `Voucher creation failed or incorrect values`,
        {
          voucherId: voucher.voucherId,
          amount: voucher.amount,
          investmentValue: voucher.investmentValue,
        }
      );

      return voucher;
    } else {
      logTest("Create Voucher (Gateway Disabled)", false, "API returned error", response.data);
      return null;
    }
  } catch (error: any) {
    logTest(
      "Create Voucher (Gateway Disabled)",
      false,
      "Exception occurred",
      undefined,
      error.message
    );
    return null;
  }
}

// Test 3: Admin creates voucher for user
async function testAdminCreateVoucher() {
  log("=".repeat(60));
  log("TEST 3: Admin Creates Voucher for User");
  log("=".repeat(60));

  try {
    const { user1 } = await setupTestData();
    const adminToken = await getAdminToken();

    const response = await axios.post(
      `${API_BASE_URL}/admin/vouchers`,
      {
        userId: "VOUCHER-TEST-1",
        amount: 200,
        expiryDays: 120,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    if (response.data.status === "success" && response.data.data.voucher) {
      const voucher = response.data.data.voucher;
      const expectedInvestmentValue = 200 * 2;

      const passed =
        voucher.amount === 200 &&
        voucher.investmentValue === expectedInvestmentValue &&
        voucher.status === "active" &&
        voucher.user.userId === "VOUCHER-TEST-1";

      logTest(
        "Admin Creates Voucher",
        passed,
        passed
          ? `Admin created voucher successfully: ${voucher.voucherId}`
          : `Admin voucher creation failed or incorrect values`,
        {
          voucherId: voucher.voucherId,
          amount: voucher.amount,
          investmentValue: voucher.investmentValue,
          user: voucher.user,
        }
      );

      return voucher;
    } else {
      logTest("Admin Creates Voucher", false, "API returned error", response.data);
      return null;
    }
  } catch (error: any) {
    logTest(
      "Admin Creates Voucher",
      false,
      "Exception occurred",
      undefined,
      error.message
    );
    return null;
  }
}

// Test 4: Use $100 voucher for $100 investment (BUG FIX TEST)
async function testVoucherFullCoverageSmallInvestment() {
  log("=".repeat(60));
  log("TEST 4: Use $100 Voucher for $100 Investment (BUG FIX)");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // First create a $100 voucher
    const voucherResponse = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      {
        amount: 100,
        fromWalletType: "ROI",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (voucherResponse.data.status !== "success") {
      logTest(
        "Voucher Full Coverage (Small Investment)",
        false,
        "Failed to create voucher",
        voucherResponse.data
      );
      return false;
    }

    const voucher = voucherResponse.data.data.voucher;
    const voucherId = voucher.voucherId;
    const investmentValue = voucher.investmentValue; // Should be $200

    log(`Created voucher: ${voucherId}, Investment Value: $${investmentValue}`);

    // Now try to use it for a $100 investment
    const paymentResponse = await axios.post(
      `${API_BASE_URL}/payment/create`,
      {
        packageId: testPackage._id.toString(),
        amount: 100, // $100 investment
        currency: "USD",
        voucherId: voucherId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (paymentResponse.data.status === "success") {
      const investment = paymentResponse.data.data.investment;
      const passed =
        investment &&
        investment.amount === 100 &&
        investment.voucherUsed &&
        investment.voucherUsed.voucherId === voucherId &&
        investment.remainingAmount === 0;

      logTest(
        "Voucher Full Coverage (Small Investment)",
        passed,
        passed
          ? `✅ BUG FIXED: $100 voucher (investment value $200) successfully used for $100 investment`
          : `❌ BUG STILL EXISTS: Investment created but voucher not properly applied`,
        {
          investmentAmount: investment?.amount,
          voucherInvestmentValue: investmentValue,
          voucherUsed: investment?.voucherUsed,
          remainingAmount: investment?.remainingAmount,
        }
      );

      return passed;
    } else {
      logTest(
        "Voucher Full Coverage (Small Investment)",
        false,
        "Payment/investment creation failed",
        paymentResponse.data
      );
      return false;
    }
    } catch (error: any) {
      const errorDetails = error.response?.data || { message: error.message };
      const statusCode = error.response?.status || 'N/A';
      logTest(
        "Voucher Full Coverage (Small Investment)",
        false,
        `Exception occurred (Status: ${statusCode})`,
        errorDetails,
        error.message
      );
      return false;
    }
}

// Test 5: Use $100 voucher for $200 investment (full coverage)
async function testVoucherFullCoverageExactMatch() {
  log("=".repeat(60));
  log("TEST 5: Use $100 Voucher for $200 Investment (Exact Match)");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create a $100 voucher
    const voucherResponse = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      {
        amount: 100,
        fromWalletType: "ROI",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (voucherResponse.data.status !== "success") {
      logTest("Voucher Full Coverage (Exact Match)", false, "Failed to create voucher");
      return false;
    }

    const voucher = voucherResponse.data.data.voucher;
    const voucherId = voucher.voucherId;

    // Use it for a $200 investment (exact match with investment value)
    const paymentResponse = await axios.post(
      `${API_BASE_URL}/payment/create`,
      {
        packageId: testPackage._id.toString(),
        amount: 200,
        currency: "USD",
        voucherId: voucherId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (paymentResponse.data.status === "success") {
      const investment = paymentResponse.data.data.investment;
      const passed =
        investment &&
        investment.amount === 200 &&
        investment.voucherUsed &&
        investment.voucherUsed.voucherId === voucherId &&
        investment.remainingAmount === 0;

      logTest(
        "Voucher Full Coverage (Exact Match)",
        passed,
        passed
          ? `$100 voucher successfully used for $200 investment (exact match)`
          : `Investment created but voucher not properly applied`,
        {
          investmentAmount: investment?.amount,
          voucherUsed: investment?.voucherUsed,
          remainingAmount: investment?.remainingAmount,
        }
      );

      return passed;
    } else {
      logTest("Voucher Full Coverage (Exact Match)", false, "Payment creation failed", paymentResponse.data);
      return false;
    }
  } catch (error: any) {
    logTest("Voucher Full Coverage (Exact Match)", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 6: Use $100 voucher for $300 investment (partial coverage)
async function testVoucherPartialCoverage() {
  log("=".repeat(60));
  log("TEST 6: Use $100 Voucher for $300 Investment (Partial Coverage)");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create a $100 voucher
    const voucherResponse = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      {
        amount: 100,
        fromWalletType: "ROI",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (voucherResponse.data.status !== "success") {
      logTest("Voucher Partial Coverage", false, "Failed to create voucher");
      return false;
    }

    const voucher = voucherResponse.data.data.voucher;
    const voucherId = voucher.voucherId;
    const voucherInvestmentValue = voucher.investmentValue; // $200

    // Use it for a $300 investment (partial coverage - should pay $100 remaining)
    const paymentResponse = await axios.post(
      `${API_BASE_URL}/payment/create`,
      {
        packageId: testPackage._id.toString(),
        amount: 300,
        currency: "USD",
        voucherId: voucherId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (paymentResponse.data.status === "success") {
      const remainingAmount = paymentResponse.data.data.remainingAmount;
      const expectedRemaining = 300 - voucherInvestmentValue; // $100

      const passed =
        remainingAmount === expectedRemaining &&
        paymentResponse.data.data.voucher &&
        paymentResponse.data.data.payment; // Should create payment for remaining

      logTest(
        "Voucher Partial Coverage",
        passed,
        passed
          ? `$100 voucher (investment value $200) used for $300 investment, remaining $${remainingAmount} to pay`
          : `Partial coverage not working correctly`,
        {
          investmentAmount: 300,
          voucherInvestmentValue,
          remainingAmount,
          expectedRemaining,
          hasPayment: !!paymentResponse.data.data.payment,
        }
      );

      return passed;
    } else {
      logTest("Voucher Partial Coverage", false, "Payment creation failed", paymentResponse.data);
      return false;
    }
  } catch (error: any) {
    logTest("Voucher Partial Coverage", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 7: Get user vouchers
async function testGetUserVouchers() {
  log("=".repeat(60));
  log("TEST 7: Get User Vouchers");
  log("=".repeat(60));

  try {
    const { user1 } = await setupTestData();
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create a few vouchers first
    await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      { amount: 50, fromWalletType: "ROI" },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      { amount: 75, fromWalletType: "ROI" },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Get vouchers
    const response = await axios.get(`${API_BASE_URL}/user/vouchers`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.status === "success" && response.data.data.vouchers) {
      const vouchers = response.data.data.vouchers;
      const passed = Array.isArray(vouchers) && vouchers.length >= 2;

      logTest(
        "Get User Vouchers",
        passed,
        passed
          ? `Retrieved ${vouchers.length} vouchers successfully`
          : `Failed to retrieve vouchers or incorrect count`,
        {
          count: vouchers.length,
          voucherIds: vouchers.map((v: any) => v.voucherId),
        }
      );

      return passed;
    } else {
      logTest("Get User Vouchers", false, "API returned error", response.data);
      return false;
    }
  } catch (error: any) {
    logTest("Get User Vouchers", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 8: Get user vouchers with status filter
async function testGetUserVouchersWithFilter() {
  log("=".repeat(60));
  log("TEST 8: Get User Vouchers with Status Filter");
  log("=".repeat(60));

  try {
    const { user1 } = await setupTestData();
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Get active vouchers
    const response = await axios.get(`${API_BASE_URL}/user/vouchers?status=active`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.status === "success" && response.data.data.vouchers) {
      const vouchers = response.data.data.vouchers;
      const allActive = vouchers.every((v: any) => v.status === "active");

      logTest(
        "Get User Vouchers with Filter",
        allActive,
        allActive
          ? `Retrieved ${vouchers.length} active vouchers`
          : `Some vouchers are not active`,
        {
          count: vouchers.length,
          allActive,
        }
      );

      return allActive;
    } else {
      logTest("Get User Vouchers with Filter", false, "API returned error", response.data);
      return false;
    }
  } catch (error: any) {
    logTest("Get User Vouchers with Filter", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 9: Admin get all vouchers
async function testAdminGetAllVouchers() {
  log("=".repeat(60));
  log("TEST 9: Admin Get All Vouchers");
  log("=".repeat(60));

  try {
    await setupTestData();
    const adminToken = await getAdminToken();

    const response = await axios.get(`${API_BASE_URL}/admin/vouchers`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    if (response.data.status === "success" && response.data.data.vouchers) {
      const vouchers = response.data.data.vouchers;
      const passed = Array.isArray(vouchers);

      logTest(
        "Admin Get All Vouchers",
        passed,
        passed
          ? `Admin retrieved ${vouchers.length} vouchers successfully`
          : `Failed to retrieve vouchers`,
        {
          count: vouchers.length,
        }
      );

      return passed;
    } else {
      logTest("Admin Get All Vouchers", false, "API returned error", response.data);
      return false;
    }
  } catch (error: any) {
    logTest("Admin Get All Vouchers", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 10: Voucher validation (expired voucher)
async function testVoucherExpiredValidation() {
  log("=".repeat(60));
  log("TEST 10: Voucher Expired Validation");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create an expired voucher directly in DB
    const expiredVoucher = await Voucher.create({
      voucherId: `VCH-EXPIRED-${Date.now()}`,
      user: user1._id,
      amount: Types.Decimal128.fromString("100"),
      investmentValue: Types.Decimal128.fromString("200"),
      multiplier: 2,
      status: "active",
      expiry: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
    });

    // Try to use expired voucher
    try {
      await axios.post(
        `${API_BASE_URL}/payment/create`,
        {
          packageId: testPackage._id.toString(),
          amount: 100,
          currency: "USD",
          voucherId: expiredVoucher.voucherId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logTest(
        "Voucher Expired Validation",
        false,
        "Expired voucher was accepted (should be rejected)",
        { voucherId: expiredVoucher.voucherId }
      );
      return false;
    } catch (error: any) {
      const isRejected = error.response?.status === 400 && error.response?.data?.message?.includes("expired");
      logTest(
        "Voucher Expired Validation",
        isRejected,
        isRejected
          ? `Expired voucher correctly rejected`
          : `Expired voucher validation failed`,
        { error: error.response?.data?.message }
      );
      return isRejected;
    }
  } catch (error: any) {
    logTest("Voucher Expired Validation", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 11: Voucher validation (used voucher)
async function testVoucherUsedValidation() {
  log("=".repeat(60));
  log("TEST 11: Voucher Used Validation");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create and use a voucher
    const voucherResponse = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      { amount: 100, fromWalletType: "ROI" },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const voucherId = voucherResponse.data.data.voucher.voucherId;

    // Use the voucher
    await axios.post(
      `${API_BASE_URL}/payment/create`,
      {
        packageId: testPackage._id.toString(),
        amount: 100,
        currency: "USD",
        voucherId: voucherId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Try to use the same voucher again
    try {
      await axios.post(
        `${API_BASE_URL}/payment/create`,
        {
          packageId: testPackage._id.toString(),
          amount: 100,
          currency: "USD",
          voucherId: voucherId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logTest("Voucher Used Validation", false, "Used voucher was accepted (should be rejected)");
      return false;
    } catch (error: any) {
      const isRejected =
        error.response?.status === 404 && error.response?.data?.message?.includes("already used");
      logTest(
        "Voucher Used Validation",
        isRejected,
        isRejected
          ? `Used voucher correctly rejected`
          : `Used voucher validation failed`,
        { error: error.response?.data?.message }
      );
      return isRejected;
    }
  } catch (error: any) {
    logTest("Voucher Used Validation", false, "Exception occurred", undefined, error.message);
    return false;
  }
}

// Test 12: Investment with voucher when gateway is disabled
async function testInvestmentWithVoucherGatewayDisabled() {
  log("=".repeat(60));
  log("TEST 12: Investment with Voucher (Gateway Disabled)");
  log("=".repeat(60));

  try {
    const { user1, testPackage } = await setupTestData();
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = await getAuthToken("VOUCHER-TEST-1");

    // Create a voucher
    const voucherResponse = await axios.post(
      `${API_BASE_URL}/user/vouchers/create`,
      { amount: 100 },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const voucherId = voucherResponse.data.data.voucher.voucherId;

    // Try to create investment with voucher (gateway should be disabled in test env)
    const paymentResponse = await axios.post(
      `${API_BASE_URL}/payment/create`,
      {
        packageId: testPackage._id.toString(),
        amount: 100,
        currency: "USD",
        voucherId: voucherId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Should either create investment directly or return payment URL
    const hasInvestment = !!paymentResponse.data.data?.investment;
    const hasPayment = !!paymentResponse.data.data?.payment;

    const passed = paymentResponse.data.status === "success" && (hasInvestment || hasPayment);

    logTest(
      "Investment with Voucher (Gateway Disabled)",
      passed,
      passed
        ? `Investment created successfully with voucher (gateway disabled)`
        : `Investment creation failed`,
      {
        hasInvestment,
        hasPayment,
        response: paymentResponse.data,
      }
    );

    return passed;
  } catch (error: any) {
    // If gateway is disabled, it should create investment directly
    if (error.response?.data?.data?.investment) {
      logTest(
        "Investment with Voucher (Gateway Disabled)",
        true,
        `Investment created directly (gateway disabled)`,
        { investment: error.response.data.data.investment }
      );
      return true;
    }

    logTest(
      "Investment with Voucher (Gateway Disabled)",
      false,
      "Exception occurred",
      undefined,
      error.message
    );
    return false;
  }
}

// Main test runner
async function runVoucherAPITests() {
  try {
    // Clear log file
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }

    log("=".repeat(80));
    log("🚀 VOUCHER API TEST SUITE");
    log("=".repeat(80));
    log("");

    // Connect to MongoDB
    log(`Connecting to MongoDB at: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}...`);
    await mongoose.connect(MONGODB_URI);
    log("✅ Connected to MongoDB\n");

    // Run all tests
    await testCreateVoucherFromWallet();
    await testCreateVoucherGatewayDisabled();
    await testAdminCreateVoucher();
    await testVoucherFullCoverageSmallInvestment(); // BUG FIX TEST
    await testVoucherFullCoverageExactMatch();
    await testVoucherPartialCoverage();
    await testGetUserVouchers();
    await testGetUserVouchersWithFilter();
    await testAdminGetAllVouchers();
    await testVoucherExpiredValidation();
    await testVoucherUsedValidation();
    await testInvestmentWithVoucherGatewayDisabled();

    // Summary
    const total = testResults.length;
    const passed = testResults.filter((t) => t.passed).length;
    const failed = testResults.filter((t) => !t.passed).length;
    const successRate = (passed / total) * 100;

    log("");
    log("=".repeat(80));
    log("🎯 TEST SUMMARY");
    log("=".repeat(80));
    log(`Total Tests: ${total}`);
    log(`✅ Passed: ${passed}`);
    log(`❌ Failed: ${failed}`);
    log(`Success Rate: ${successRate.toFixed(2)}%`);
    log("=".repeat(80));
    log("");

    // List failed tests
    if (failed > 0) {
      log("❌ FAILED TESTS:");
      testResults
        .filter((t) => !t.passed)
        .forEach((t) => {
          log(`  - ${t.name}: ${t.message}`);
          if (t.error) {
            log(`    Error: ${t.error}`);
          }
        });
      log("");
    }

    log(`📄 Full log saved to: ${LOG_FILE}\n`);

    await mongoose.disconnect();
    log("✅ Disconnected from MongoDB");

    // Exit with error code if any tests failed
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    log(`\n❌ Test execution error: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

// Run the tests
runVoucherAPITests();

