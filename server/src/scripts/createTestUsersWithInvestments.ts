/**
 * Test Script - Create 12 Users with Investments
 * Creates a tree structure:
 * - Admin (CROWN-000000) has 3 children
 * - Each of those 3 children has their own subtree
 * - Each user makes an investment to simulate referral and binary income
 * 
 * Usage: npx ts-node src/scripts/createTestUsersWithInvestments.ts
 * Or: npm run test:users:investments (if script is added to package.json)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";
import { processInvestment } from "../services/investment.service";
import connectdb from "../db/index";

// Load environment variables
dotenv.config({ path: "./.env" });

const MONGODB_URL = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "";

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

    // Process investment
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
 * Main function to create test users and investments
 */
async function createTestUsersWithInvestments() {
  try {
    console.log("🚀 Starting test user creation with investments...\n");

    // Connect to database
    await connectdb();
    console.log("✅ Database connected\n");

    // Get or create admin user
    let adminUser = await findUserByUserId("CROWN-000000");
    if (!adminUser) {
      console.log("📝 Creating admin user (CROWN-000000)...");
      const adminResult = await createTestUser(0, null, null, "Admin User");
      adminUser = adminResult.user;
      console.log(`✅ Admin user created: ${adminResult.userId}\n`);
    } else {
      console.log(`✅ Admin user already exists: CROWN-000000\n`);
    }

    // Get a package for investments (use first available package)
    const packages = await Package.find({ status: "Active" }).limit(1);
    if (packages.length === 0) {
      throw new Error("No active packages found. Please seed packages first.");
    }
    const testPackage = packages[0];
    const investmentAmount = parseFloat(testPackage.minAmount.toString());
    
    console.log(`📦 Using package: ${testPackage.packageName} ($${investmentAmount})\n`);

    const rootUserId = adminUser.userId;
    const createdUsers: { userId: string; user: any }[] = [];

    // Create 3 direct children of admin
    console.log("🌳 Creating 3 direct children of admin...");
    const level1Users: { userId: string; user: any }[] = [];
    
    for (let i = 1; i <= 3; i++) {
      const userResult = await createTestUser(i, rootUserId, null, `Level 1 User ${i}`);
      level1Users.push(userResult);
      createdUsers.push(userResult);
      console.log(`   ✅ Created: ${userResult.userId} (${userResult.user.name})`);
    }
    console.log("");

    // Create subtrees for each of the 3 children
    console.log("🌳 Creating subtrees for each level 1 user...");
    
    // User 1's subtree (2 children)
    console.log("   Creating subtree for Level 1 User 1...");
    const user1Children: { userId: string; user: any }[] = [];
    for (let i = 4; i <= 5; i++) {
      const userResult = await createTestUser(i, level1Users[0].userId, i === 4 ? "left" : "right", `Level 2 User ${i - 3}`);
      user1Children.push(userResult);
      createdUsers.push(userResult);
      console.log(`      ✅ Created: ${userResult.userId} (${userResult.user.name})`);
    }
    
    // User 2's subtree (2 children)
    console.log("   Creating subtree for Level 1 User 2...");
    const user2Children: { userId: string; user: any }[] = [];
    for (let i = 6; i <= 7; i++) {
      const userResult = await createTestUser(i, level1Users[1].userId, i === 6 ? "left" : "right", `Level 2 User ${i - 5}`);
      user2Children.push(userResult);
      createdUsers.push(userResult);
      console.log(`      ✅ Created: ${userResult.userId} (${userResult.user.name})`);
    }
    
    // User 3's subtree (2 children)
    console.log("   Creating subtree for Level 1 User 3...");
    const user3Children: { userId: string; user: any }[] = [];
    for (let i = 8; i <= 9; i++) {
      const userResult = await createTestUser(i, level1Users[2].userId, i === 8 ? "left" : "right", `Level 2 User ${i - 7}`);
      user3Children.push(userResult);
      createdUsers.push(userResult);
      console.log(`      ✅ Created: ${userResult.userId} (${userResult.user.name})`);
    }
    
    // Add 3 more users to fill up to 12 total (excluding admin)
    // Add them as children of level 2 users
    console.log("   Creating additional users to reach 12 total...");
    const additionalUsers: { userId: string; user: any }[] = [];
    
    // Add 1 child to first level 2 user
    const user10 = await createTestUser(10, user1Children[0].userId, "left", "Level 3 User 1");
    additionalUsers.push(user10);
    createdUsers.push(user10);
    console.log(`      ✅ Created: ${user10.userId} (${user10.user.name})`);
    
    // Add 1 child to second level 2 user
    const user11 = await createTestUser(11, user2Children[0].userId, "left", "Level 3 User 2");
    additionalUsers.push(user11);
    createdUsers.push(user11);
    console.log(`      ✅ Created: ${user11.userId} (${user11.user.name})`);
    
    // Add 1 child to third level 2 user
    const user12 = await createTestUser(12, user3Children[0].userId, "left", "Level 3 User 3");
    additionalUsers.push(user12);
    createdUsers.push(user12);
    console.log(`      ✅ Created: ${user12.userId} (${user12.user.name})`);
    
    console.log(`\n✅ Created ${createdUsers.length} users (excluding admin)\n`);

    // Now create investments for each user
    console.log("💰 Creating investments for all users...\n");
    
    // Create investments starting from bottom level to top (to see bonuses accumulate)
    const investmentOrder = [
      ...additionalUsers.reverse(), // Level 3 users first
      ...user3Children.reverse(),
      ...user2Children.reverse(),
      ...user1Children.reverse(), // Level 2 users
      ...level1Users.reverse(), // Level 1 users last
    ];

    let investmentCount = 0;
    for (const userData of investmentOrder) {
      try {
        await createInvestmentForUser(userData.userId, testPackage._id, investmentAmount);
        investmentCount++;
        
        // Small delay to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`   ⚠️  Skipping investment for ${userData.userId}: ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${investmentCount} investments\n`);

    // Display summary
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Users Created: ${createdUsers.length} (excluding admin)`);
    console.log(`Total Investments: ${investmentCount}`);
    console.log(`\nTree Structure:`);
    console.log(`  Admin (CROWN-000000)`);
    console.log(`  ├── Level 1 User 1 (${level1Users[0].userId})`);
    console.log(`  │   ├── Level 2 User 1 (${user1Children[0].userId})`);
    console.log(`  │   │   └── Level 3 User 1 (${user10.userId})`);
    console.log(`  │   └── Level 2 User 2 (${user1Children[1].userId})`);
    console.log(`  ├── Level 1 User 2 (${level1Users[1].userId})`);
    console.log(`  │   ├── Level 2 User 1 (${user2Children[0].userId})`);
    console.log(`  │   │   └── Level 3 User 2 (${user11.userId})`);
    console.log(`  │   └── Level 2 User 2 (${user2Children[1].userId})`);
    console.log(`  └── Level 1 User 3 (${level1Users[2].userId})`);
    console.log(`      ├── Level 2 User 1 (${user3Children[0].userId})`);
    console.log(`      │   └── Level 3 User 3 (${user12.userId})`);
    console.log(`      └── Level 2 User 2 (${user3Children[1].userId})`);
    console.log("=".repeat(60));

    // Display investment and bonus information
    console.log("\n💵 Investment Details:");
    for (const userData of createdUsers) {
      const user = await findUserByUserId(userData.userId);
      if (user) {
        const investments = await Investment.find({ user: user._id });
        const binaryTree = await BinaryTree.findOne({ user: user._id });
        
        if (investments.length > 0 || binaryTree) {
          console.log(`\n  ${userData.user.name} (${userData.userId}):`);
          if (investments.length > 0) {
            const totalInvested = investments.reduce((sum, inv) => 
              sum + parseFloat(inv.investedAmount.toString()), 0
            );
            console.log(`    💰 Total Invested: $${totalInvested.toFixed(2)}`);
          }
          if (binaryTree) {
            const leftBusiness = parseFloat(binaryTree.leftBusiness.toString());
            const rightBusiness = parseFloat(binaryTree.rightBusiness.toString());
            const minBusiness = Math.min(leftBusiness, rightBusiness);
            const binaryBonus = minBusiness * 0.1;
            console.log(`    📊 Left Business: $${leftBusiness.toFixed(2)}`);
            console.log(`    📊 Right Business: $${rightBusiness.toFixed(2)}`);
            console.log(`    🎁 Binary Bonus: $${binaryBonus.toFixed(2)}`);
          }
        }
      }
    }

    console.log("\n✨ Test data creation completed successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createTestUsersWithInvestments()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export { createTestUsersWithInvestments };

