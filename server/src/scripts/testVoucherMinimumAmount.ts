/**
 * Test Script: Voucher Minimum Amount Validation
 * 
 * Tests that voucher creation respects the minimum amount based on active packages
 * 
 * Usage: npx ts-node -r dotenv/config src/scripts/testVoucherMinimumAmount.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { Package } from "../models/Package";
import { getMinimumVoucherAmount } from "../services/package.service";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI;
const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = `${API_BASE}/api/v1`;

const TEST_USER_ID = "CROWN-000018";
const TEST_USER_PASSWORD = "Test@123";

// Helper to get auth token
async function getAuthToken(userId: string, password: string): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      userId,
      password,
    });
    return response.data.data.token;
  } catch (error: any) {
    throw new Error(`Failed to get auth token: ${error.response?.data?.message || error.message}`);
  }
}

// Helper to get admin token
async function getAdminToken(): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/login`, {
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: process.env.ADMIN_PASSWORD || "admin123",
    });
    return response.data.data.token;
  } catch (error: any) {
    throw new Error(`Failed to get admin token: ${error.response?.data?.message || error.message}`);
  }
}

// Test 1: Check minimum voucher amount calculation
async function testMinimumVoucherAmountCalculation() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Minimum Voucher Amount Calculation");
  console.log("=".repeat(60));

  try {
    // Get all active packages
    const activePackages = await Package.find({ status: "Active" })
      .select("packageName minAmount maxAmount")
      .lean();

    console.log(`\nFound ${activePackages.length} active package(s):`);
    activePackages.forEach((pkg) => {
      const minAmount = parseFloat(pkg.minAmount.toString());
      const maxAmount = parseFloat(pkg.maxAmount.toString());
      console.log(`  - ${pkg.packageName}: $${minAmount} - $${maxAmount}`);
    });

    // Calculate minimum investment
    if (activePackages.length === 0) {
      console.log("\n❌ No active packages found!");
      return false;
    }

    const minAmounts = activePackages.map((pkg) => parseFloat(pkg.minAmount.toString()));
    const minInvestment = Math.min(...minAmounts);
    const expectedMinVoucher = minInvestment / 2;

    console.log(`\n📊 Calculation:`);
    console.log(`  Minimum Investment: $${minInvestment}`);
    console.log(`  Expected Minimum Voucher: $${expectedMinVoucher}`);

    // Test the service function
    const actualMinVoucher = await getMinimumVoucherAmount();
    console.log(`  Actual Minimum Voucher (from service): $${actualMinVoucher}`);

    const passed = Math.abs(actualMinVoucher - expectedMinVoucher) < 0.01;
    console.log(`\n${passed ? "✅" : "❌"} Test ${passed ? "PASSED" : "FAILED"}`);

    return passed;
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

// Test 2: User voucher creation with amount below minimum
async function testUserVoucherBelowMinimum() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: User Voucher Creation - Amount Below Minimum");
  console.log("=".repeat(60));

  try {
    const token = await getAuthToken(TEST_USER_ID, TEST_USER_PASSWORD);
    const minVoucherAmount = await getMinimumVoucherAmount();
    const testAmount = minVoucherAmount - 10; // Amount below minimum

    console.log(`\nAttempting to create voucher with $${testAmount} (minimum is $${minVoucherAmount})`);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/user/vouchers/create`,
        {
          amount: testAmount,
          fromWalletType: "roi",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Should not succeed
      console.log("\n❌ Test FAILED: Voucher creation should have been rejected");
      console.log("Response:", response.data);
      return false;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;

      if (statusCode === 400 && errorMessage.includes("Minimum voucher amount")) {
        console.log(`\n✅ Test PASSED: Voucher creation correctly rejected`);
        console.log(`   Status: ${statusCode}`);
        console.log(`   Error: ${errorMessage}`);
        return true;
      } else {
        console.log(`\n❌ Test FAILED: Unexpected error`);
        console.log(`   Status: ${statusCode}`);
        console.log(`   Error: ${errorMessage}`);
        return false;
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

// Test 3: User voucher creation with amount at minimum
async function testUserVoucherAtMinimum() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: User Voucher Creation - Amount At Minimum");
  console.log("=".repeat(60));

  try {
    const token = await getAuthToken(TEST_USER_ID, TEST_USER_PASSWORD);
    const minVoucherAmount = await getMinimumVoucherAmount();

    console.log(`\nAttempting to create voucher with $${minVoucherAmount} (exactly at minimum)`);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/user/vouchers/create`,
        {
          amount: minVoucherAmount,
          fromWalletType: "roi",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === "success") {
        console.log(`\n✅ Test PASSED: Voucher created successfully at minimum amount`);
        console.log(`   Voucher ID: ${response.data.data.voucher.voucherId}`);
        console.log(`   Amount: $${response.data.data.voucher.amount}`);
        return true;
      } else {
        console.log("\n❌ Test FAILED: Unexpected response");
        console.log("Response:", response.data);
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.log(`\n❌ Test FAILED: Voucher creation failed`);
      console.log(`   Error: ${errorMessage}`);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

// Test 4: Admin voucher creation with amount below minimum
async function testAdminVoucherBelowMinimum() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Admin Voucher Creation - Amount Below Minimum");
  console.log("=".repeat(60));

  try {
    const adminToken = await getAdminToken();
    const minVoucherAmount = await getMinimumVoucherAmount();
    const testAmount = minVoucherAmount - 10; // Amount below minimum

    console.log(`\nAttempting to create voucher for ${TEST_USER_ID} with $${testAmount} (minimum is $${minVoucherAmount})`);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/vouchers`,
        {
          userId: TEST_USER_ID,
          amount: testAmount,
          expiryDays: 120,
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      // Should not succeed
      console.log("\n❌ Test FAILED: Voucher creation should have been rejected");
      console.log("Response:", response.data);
      return false;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;

      if (statusCode === 400 && errorMessage.includes("Minimum voucher amount")) {
        console.log(`\n✅ Test PASSED: Voucher creation correctly rejected`);
        console.log(`   Status: ${statusCode}`);
        console.log(`   Error: ${errorMessage}`);
        return true;
      } else {
        console.log(`\n❌ Test FAILED: Unexpected error`);
        console.log(`   Status: ${statusCode}`);
        console.log(`   Error: ${errorMessage}`);
        return false;
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

// Test 5: Admin voucher creation with amount at minimum
async function testAdminVoucherAtMinimum() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Admin Voucher Creation - Amount At Minimum");
  console.log("=".repeat(60));

  try {
    const adminToken = await getAdminToken();
    const minVoucherAmount = await getMinimumVoucherAmount();

    console.log(`\nAttempting to create voucher for ${TEST_USER_ID} with $${minVoucherAmount} (exactly at minimum)`);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/vouchers`,
        {
          userId: TEST_USER_ID,
          amount: minVoucherAmount,
          expiryDays: 120,
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (response.data.status === "success") {
        console.log(`\n✅ Test PASSED: Voucher created successfully at minimum amount`);
        console.log(`   Voucher ID: ${response.data.data.voucher.voucherId}`);
        console.log(`   Amount: $${response.data.data.voucher.amount}`);
        return true;
      } else {
        console.log("\n❌ Test FAILED: Unexpected response");
        console.log("Response:", response.data);
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.log(`\n❌ Test FAILED: Voucher creation failed`);
      console.log(`   Error: ${errorMessage}`);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  try {
    console.log("=".repeat(60));
    console.log("🚀 VOUCHER MINIMUM AMOUNT TEST SUITE");
    console.log("=".repeat(60));

    // Connect to MongoDB
    console.log(`\nConnecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const results = [];

    // Run all tests
    results.push(await testMinimumVoucherAmountCalculation());
    results.push(await testUserVoucherBelowMinimum());
    results.push(await testUserVoucherAtMinimum());
    results.push(await testAdminVoucherBelowMinimum());
    results.push(await testAdminVoucherAtMinimum());

    // Summary
    const total = results.length;
    const passed = results.filter((r) => r).length;
    const failed = total - passed;

    console.log("\n" + "=".repeat(60));
    console.log("🎯 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
    console.log("=".repeat(60) + "\n");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

    // Exit with error code if any tests failed
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
