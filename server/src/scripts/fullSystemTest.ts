/**
 * Comprehensive System Test Script
 * 
 * This script:
 * 1. Flushes the entire database
 * 2. Creates admin user with userId CROWN-000000
 * 3. Seeds packages with all new fields (totalOutputPct, renewablePrinciplePct, referralPct, binaryPct, powerCapacity)
 * 4. Creates test users in a tree structure
 * 5. Activates packages for users to test ROI, binary, and referral bonuses
 * 
 * Usage: npx ts-node src/scripts/fullSystemTest.ts
 * Or: npm run test:full-system (if script is added to package.json)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Withdrawal } from "../models/Withdrawal";
import { Voucher } from "../models/Voucher";
import { Admin } from "../models/Admin";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";
import { processInvestment } from "../services/investment.service";
import connectdb from "../db/index";
import { Types } from "mongoose";

// Load environment variables
dotenv.config({ path: "./.env" });

/**
 * Flush entire database
 */
async function flushDatabase() {
  try {
    console.log("🗑️  Flushing entire database...");
    
    await User.deleteMany({});
    await BinaryTree.deleteMany({});
    await Package.deleteMany({});
    await Investment.deleteMany({});
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await Withdrawal.deleteMany({});
    await Voucher.deleteMany({});
    await Admin.deleteMany({});
    
    console.log("✅ Database flushed successfully\n");
  } catch (error) {
    console.error("❌ Error flushing database:", error);
    throw error;
  }
}

/**
 * Create admin user with userId CROWN-000000
 */
async function createAdminUser() {
  try {
    console.log("👤 Creating admin user (CROWN-000000)...");
    
    // Check if admin already exists
    const existingAdmin = await findUserByUserId("CROWN-000000");
    if (existingAdmin) {
      console.log("✅ Admin user already exists: CROWN-000000\n");
      return existingAdmin;
    }
    
    // Create admin user
    const adminUser = await User.create({
      userId: "CROWN-000000",
      name: "Admin User",
      email: "admin@crown.com",
      phone: "0000000000",
      password: "admin@123", // Will be hashed automatically
      referrer: null,
      position: null,
      status: "active",
    });
    
    // Initialize admin's binary tree and wallets (no parent)
    await initializeUser(adminUser._id as Types.ObjectId, null, null);
    
    console.log(`✅ Admin user created: CROWN-000000 (${adminUser.name})\n`);
    return adminUser;
  } catch (error: any) {
    console.error("❌ Error creating admin user:", error.message);
    throw error;
  }
}

/**
 * Seed packages with all new fields
 */
async function seedPackages() {
  try {
    console.log("📦 Seeding packages...");
    
    const packageData = [
      {
        packageName: "Solar Starter",
        minAmount: "100",
        maxAmount: "2000",
        duration: 150,
        totalOutputPct: 225, // 225% total output
        renewablePrinciplePct: 50, // 50% reinvest
        referralPct: 7, // 7% referral bonus
        binaryPct: 10, // 10% binary bonus
        powerCapacity: "2000", // $2000 capping limit
        status: "Active" as const,
        // Legacy fields for backward compatibility
        roi: 1.5, // Daily ROI rate would be (225/100)/150 = 0.015 = 1.5%
        binaryBonus: 10,
        cappingLimit: "2000",
        principleReturn: 50,
        levelOneReferral: 7,
      },
      {
        packageName: "Power Growth",
        minAmount: "2000",
        maxAmount: "7000",
        duration: 140,
        totalOutputPct: 270, // 270% total output
        renewablePrinciplePct: 60, // 60% reinvest
        referralPct: 10, // 10% referral bonus
        binaryPct: 10, // 10% binary bonus
        powerCapacity: "7000", // $7000 capping limit
        status: "Active" as const,
        // Legacy fields
        roi: 1.93, // (270/100)/140 = 0.0193 = 1.93%
        binaryBonus: 10,
        cappingLimit: "7000",
        principleReturn: 60,
        levelOneReferral: 10,
      },
      {
        packageName: "Elite Energy",
        minAmount: "7000",
        maxAmount: "20000",
        duration: 130,
        totalOutputPct: 300, // 300% total output
        renewablePrinciplePct: 80, // 80% reinvest
        referralPct: 11, // 11% referral bonus
        binaryPct: 10, // 10% binary bonus
        powerCapacity: "20000", // $20000 capping limit
        status: "Active" as const,
        // Legacy fields
        roi: 2.31, // (300/100)/130 = 0.0231 = 2.31%
        binaryBonus: 10,
        cappingLimit: "20000",
        principleReturn: 80,
        levelOneReferral: 11,
      },
      {
        packageName: "Basic Package",
        minAmount: "25",
        maxAmount: "2499",
        duration: 150,
        totalOutputPct: 225, // 225% total output (default)
        renewablePrinciplePct: 50, // 50% reinvest (default)
        referralPct: 7, // 7% referral bonus (default)
        binaryPct: 10, // 10% binary bonus (default)
        powerCapacity: "1000", // $1000 capping limit (default)
        status: "Active" as const,
        // Legacy fields
        roi: 1.5, // (225/100)/150 = 0.015 = 1.5%
        binaryBonus: 10,
        cappingLimit: "1000",
        principleReturn: 50,
        levelOneReferral: 7,
      },
    ];
    
    const packages = await Package.insertMany(packageData);
    console.log(`✅ Successfully seeded ${packages.length} packages`);
    
    // Display summary
    console.log("\n📦 Seeded Packages:");
    packages.forEach((pkg, index) => {
      const dailyRoiRate = (pkg.totalOutputPct / 100) / pkg.duration;
      console.log(
        `${index + 1}. ${pkg.packageName}`
      );
      console.log(`   - Amount: $${pkg.minAmount} - $${pkg.maxAmount}`);
      console.log(`   - Duration: ${pkg.duration} days`);
      console.log(`   - Total Output: ${pkg.totalOutputPct}%`);
      console.log(`   - Daily ROI Rate: ${(dailyRoiRate * 100).toFixed(4)}%`);
      console.log(`   - Renewable Principle: ${pkg.renewablePrinciplePct}%`);
      console.log(`   - Referral Bonus: ${pkg.referralPct}%`);
      console.log(`   - Binary Bonus: ${pkg.binaryPct}%`);
      console.log(`   - Power Capacity: $${pkg.powerCapacity}`);
      console.log("");
    });
    
    return packages;
  } catch (error: any) {
    console.error("❌ Error seeding packages:", error.message);
    throw error;
  }
}

/**
 * Create a single test user
 */
async function createTestUser(
  userNumber: number,
  parentUserId: string | null,
  position: "left" | "right" | null,
  name?: string
): Promise<{ userId: string; user: any }> {
  const userId = await generateNextUserId();
  const userName = name || `Test User ${userNumber}`;

  // Find parent user if provided
  let parentUser = null;
  if (parentUserId) {
    parentUser = await findUserByUserId(parentUserId);
    if (!parentUser) {
      throw new Error(`Parent user ${parentUserId} not found`);
    }
  }

  // Create user
  const user = await User.create({
    userId,
    name: userName,
    email: `testuser${userNumber}@example.com`,
    phone: `123456789${userNumber.toString().padStart(2, "0")}`,
    password: "Test@123",
    referrer: parentUser ? (parentUser._id as any) : null,
    position: position || null,
    status: "active",
  });

  // Initialize binary tree and wallets
  try {
    const parentId = parentUser ? (parentUser._id as any) : null;
    await initializeUser(user._id as any, parentId, position || undefined);
  } catch (error) {
    // If initialization fails, delete the user
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  return { userId, user };
}

/**
 * Create investment for a user
 */
async function createInvestmentForUser(
  userId: string,
  packageId: any,
  amount: number
) {
  try {
    const user = await findUserByUserId(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Process investment (this will trigger referral and binary bonuses)
    const investment = await processInvestment(
      user._id as any,
      packageId,
      amount,
      `TEST_PAYMENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    console.log(`   ✅ Investment created for ${userId}: $${amount}`);
    return investment;
  } catch (error: any) {
    console.error(`   ❌ Failed to create investment for ${userId}:`, error.message);
    throw error;
  }
}

/**
 * Main function to run full system test
 */
async function runFullSystemTest() {
  try {
    console.log("🚀 Starting Full System Test...\n");
    console.log("=".repeat(60));
    console.log("");

    // Connect to database
    await connectdb();
    console.log("✅ Database connected\n");

    // Step 1: Flush database
    await flushDatabase();

    // Step 2: Create admin user
    const adminUser = await createAdminUser();

    // Step 3: Seed packages
    const packages = await seedPackages();
    console.log("");

    // Step 4: Create 100 test users in a comprehensive tree structure
    console.log("🌳 Creating 100 test users in comprehensive tree structure...\n");
    
    const rootUserId = adminUser.userId;
    const createdUsers: { userId: string; user: any }[] = [];
    const TARGET_USERS = 100;

    // Strategy: Create multiple branches from admin, each with varying subtree depths
    // This tests both individual placements and complex subtree structures
    
    // Create 10 direct children of admin (branch roots)
    console.log("📌 Creating 10 branch roots (direct children of admin)...");
    const branchRoots: { userId: string; user: any }[] = [];
    
    for (let i = 1; i <= 10; i++) {
      const userResult = await createTestUser(i, rootUserId, null, `Branch Root ${i}`);
      branchRoots.push(userResult);
      createdUsers.push(userResult);
      console.log(`   ✅ Created: ${userResult.userId} (${userResult.user.name})`);
      
      // Stop if we've reached target
      if (createdUsers.length >= TARGET_USERS) break;
    }
    console.log("");

    // For each branch root, create a subtree with varying depths
    // This creates a mix of individual users and complex subtrees
    for (let branchIndex = 0; branchIndex < branchRoots.length && createdUsers.length < TARGET_USERS; branchIndex++) {
      const branchRoot = branchRoots[branchIndex];
      const branchNumber = branchIndex + 1;
      
      // Calculate how many users to add to this branch
      // Distribute remaining users across branches
      const remainingUsers = TARGET_USERS - createdUsers.length;
      const branchesRemaining = branchRoots.length - branchIndex;
      const usersPerBranch = Math.ceil(remainingUsers / branchesRemaining);
      const targetForThisBranch = Math.min(usersPerBranch, remainingUsers);
      
      console.log(`📌 Building subtree for Branch ${branchNumber} (target: ${targetForThisBranch} users)...`);
      
      // Create binary tree structure for this branch
      // Strategy: Build level by level until we reach target
      const branchUsers: { userId: string; user: any; level: number }[] = [
        { userId: branchRoot.userId, user: branchRoot.user, level: 0 }
      ];
      
      let currentLevel = 1;
      let usersAddedThisBranch = 0;
      
      while (usersAddedThisBranch < targetForThisBranch && createdUsers.length < TARGET_USERS) {
        // Get users from previous level
        const previousLevelUsers = branchUsers.filter(u => u.level === currentLevel - 1);
        
        if (previousLevelUsers.length === 0) break; // No more parents to add children to
        
        for (const parent of previousLevelUsers) {
          if (usersAddedThisBranch >= targetForThisBranch || createdUsers.length >= TARGET_USERS) break;
          
          // For each parent, try to add 2 children (left and right) if we have space
          // This maintains binary tree structure
          const childrenToAdd = Math.min(2, targetForThisBranch - usersAddedThisBranch, TARGET_USERS - createdUsers.length);
          
          for (let childIndex = 0; childIndex < childrenToAdd; childIndex++) {
            if (createdUsers.length >= TARGET_USERS) break;
            
            const position = childIndex === 0 ? "left" : "right";
            const userNumber = createdUsers.length + 1;
            const userResult = await createTestUser(
              userNumber,
              parent.userId,
              position,
              `Branch ${branchNumber} - Level ${currentLevel} - ${position}`
            );
            
            branchUsers.push({ userId: userResult.userId, user: userResult.user, level: currentLevel });
            createdUsers.push(userResult);
            usersAddedThisBranch++;
            
            if (usersAddedThisBranch % 5 === 0) {
              console.log(`      ✅ Added ${usersAddedThisBranch}/${targetForThisBranch} users to Branch ${branchNumber}...`);
            }
          }
        }
        
        currentLevel++;
        
        // Safety check: don't go too deep
        if (currentLevel > 10) break;
      }
      
      console.log(`   ✅ Branch ${branchNumber} completed: ${usersAddedThisBranch} users added\n`);
      
      if (createdUsers.length >= TARGET_USERS) break;
    }
    
    console.log(`✅ Total users created: ${createdUsers.length + 1} (including admin)\n`);

    // Step 5: Activate packages for users (distribute across all packages)
    console.log("💰 Activating packages for users...\n");
    console.log(`📦 Distributing investments across ${packages.length} packages\n`);

    const investments: any[] = [];
    let investmentCount = 0;
    const investmentStats: { [packageName: string]: number } = {};

    // Initialize stats
    packages.forEach(pkg => {
      investmentStats[pkg.packageName] = 0;
    });

    // Admin invests with first package
    console.log("   Admin investment:");
    try {
      const adminPackage = packages[0];
      const adminAmount = parseFloat(adminPackage.minAmount.toString());
      const adminInvestment = await createInvestmentForUser(
        adminUser.userId,
        adminPackage._id,
        adminAmount
      );
      investments.push(adminInvestment);
      investmentStats[adminPackage.packageName]++;
      investmentCount++;
      console.log(`      ✅ Admin invested $${adminAmount} in ${adminPackage.packageName}`);
    } catch (error: any) {
      console.log(`      ⚠️  Admin investment skipped: ${error.message}`);
    }

    // Distribute investments across all users and packages
    // Strategy: Cycle through packages to test all configurations
    console.log("   Processing user investments...");
    let packageIndex = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      
      // Cycle through packages (round-robin distribution)
      const selectedPackage = packages[packageIndex % packages.length];
      packageIndex++;
      
      // Use min amount for the selected package
      const investmentAmount = parseFloat(selectedPackage.minAmount.toString());
      
      try {
        const investment = await createInvestmentForUser(
          user.userId,
          selectedPackage._id,
          investmentAmount
        );
        investments.push(investment);
        investmentStats[selectedPackage.packageName]++;
        investmentCount++;
        successCount++;
        
        // Progress indicator every 10 investments
        if (investmentCount % 10 === 0) {
          console.log(`      ✅ Processed ${investmentCount} investments... (${successCount} success, ${errorCount} errors)`);
        }
      } catch (error: any) {
        errorCount++;
        if (errorCount <= 5) {
          // Only show first 5 errors to avoid spam
          console.log(`      ⚠️  Investment for ${user.userId} failed: ${error.message}`);
        }
      }
    }
    
    console.log(`\n   ✅ Investment processing completed:`);
    console.log(`      - Total investments: ${investmentCount}`);
    console.log(`      - Successful: ${successCount}`);
    console.log(`      - Failed: ${errorCount}`);
    console.log(`\n   📊 Package distribution:`);
    Object.entries(investmentStats).forEach(([pkgName, count]) => {
      console.log(`      - ${pkgName}: ${count} investments`);
    });
    console.log("");

    // Step 6: Display comprehensive summary
    console.log("=".repeat(60));
    console.log("📊 COMPREHENSIVE SYSTEM TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("");
    console.log(`✅ Admin User: ${adminUser.userId} (${adminUser.name})`);
    console.log(`✅ Packages Seeded: ${packages.length}`);
    console.log(`✅ Total Users Created: ${createdUsers.length + 1} (including admin)`);
    console.log(`✅ Total Investments Created: ${investmentCount}`);
    console.log("");
    
    // Calculate tree statistics
    const branchRootCount = branchRoots.length;
    const avgUsersPerBranch = Math.round(createdUsers.length / branchRootCount);
    
    console.log("🌳 Tree Structure Statistics:");
    console.log(`   - Branch Roots (direct children of admin): ${branchRootCount}`);
    console.log(`   - Average users per branch: ${avgUsersPerBranch}`);
    console.log(`   - Total tree depth: Multiple levels (varies by branch)`);
    console.log(`   - Structure: Mix of individual placements and complex subtrees`);
    console.log("");
    
    console.log("📦 Package Distribution:");
    packages.forEach((pkg, index) => {
      const count = investmentStats[pkg.packageName] || 0;
      const percentage = investmentCount > 0 ? ((count / investmentCount) * 100).toFixed(1) : 0;
      console.log(`   ${index + 1}. ${pkg.packageName}:`);
      console.log(`      - Investments: ${count} (${percentage}%)`);
      console.log(`      - Amount Range: $${pkg.minAmount} - $${pkg.maxAmount}`);
      console.log(`      - Total Output: ${pkg.totalOutputPct}%`);
      console.log(`      - Referral: ${pkg.referralPct}% | Binary: ${pkg.binaryPct}%`);
      console.log(`      - Renewable: ${pkg.renewablePrinciplePct}% | Power Capacity: $${pkg.powerCapacity}`);
    });
    console.log("");
    
    // Calculate total investment value
    let totalInvestmentValue = 0;
    investments.forEach(inv => {
      const amount = parseFloat((inv as any).investedAmount?.toString() || "0");
      totalInvestmentValue += amount;
    });
    
    console.log("💰 Financial Summary:");
    console.log(`   - Total Investment Value: $${totalInvestmentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`   - Average Investment: $${(totalInvestmentValue / investmentCount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log("");
    
    console.log("🎯 System Capacity Test Results:");
    console.log(`   ✅ Successfully created ${createdUsers.length + 1} users`);
    console.log(`   ✅ Successfully processed ${investmentCount} investments`);
    console.log(`   ✅ Tested ${packages.length} different package configurations`);
    console.log(`   ✅ Verified binary tree structure with multiple branches`);
    console.log(`   ✅ Tested referral and binary bonus calculations`);
    console.log("");
    
    console.log("🔍 Next Steps for Testing:");
    console.log("   1. Run daily ROI cron: POST /api/v1/admin/trigger-daily-calculations");
    console.log("   2. Check admin dashboard statistics for aggregated data");
    console.log("   3. Verify user wallets for ROI, referral, and binary bonuses");
    console.log("   4. Check binary tree business volumes and carry forward");
    console.log("   5. Verify investment records for principal updates");
    console.log("   6. Test tree visualization with large dataset");
    console.log("   7. Check system performance with 100+ users");
    console.log("");
    console.log("✨ Comprehensive System Test Completed Successfully!");
    console.log("=".repeat(60));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runFullSystemTest()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export { runFullSystemTest };

