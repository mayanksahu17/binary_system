/**
 * Testing Script - Multiple Branches from Admin
 * Creates 50 users with max depth of 5 levels
 * Creates multiple independent branches from admin (CROWN-000000)
 * 
 * Usage: npx ts-node src/scripts/createTestUsers.ts
 * Or: npm run test:users (if script is added to package.json)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";

// Load environment variables
dotenv.config({ path: "./.env" });

const MONGODB_URL = process.env.MONGODB_URL_DEVELOPMENT || process.env.MONGODB_URI || "";

/**
 * Calculate the maximum number of nodes in a binary tree of given depth
 */
function maxNodesInDepth(depth: number): number {
  return Math.pow(2, depth) - 1;
}

/**
 * Get the level of a node in a binary tree (0-indexed)
 */
function getNodeLevel(nodeIndex: number): number {
  if (nodeIndex === 0) return 0;
  return Math.floor(Math.log2(nodeIndex + 1));
}

/**
 * Format number to CROWN-XXXXXX format
 */
function formatUserId(number: number): string {
  return `CROWN-${number.toString().padStart(6, "0")}`;
}

/**
 * Create a single test user
 */
async function createTestUser(
  userNumber: number,
  parentUserId: string | null,
  position: "left" | "right" | null,
  skipExisting: boolean = true
): Promise<{ userId: string; user: any }> {
  const userId = formatUserId(userNumber);
  const name = `Test User ${userNumber}`;
  const email = `user${userNumber}@test.com`;
  const phone = `123456${userNumber.toString().padStart(4, "0")}`;
  const password = "Test1234!";

  // Find parent user if provided
  let parentUser = null;
  if (parentUserId) {
    parentUser = await findUserByUserId(parentUserId);
    if (!parentUser) {
      throw new Error(`Parent user ${parentUserId} not found`);
    }
  }

  // Check if user already exists
  const existingUser = await findUserByUserId(userId);
  if (existingUser) {
    if (skipExisting) {
    console.log(`User ${userId} already exists, skipping...`);
    return { userId, user: existingUser };
    } else {
      // Delete existing user for testing
      await User.findByIdAndDelete(existingUser._id);
      await BinaryTree.findOneAndDelete({ user: existingUser._id });
      await Wallet.deleteMany({ user: existingUser._id });
    }
  }

  // Create user
  const user = await User.create({
    userId,
    name,
    email,
    phone,
    password,
    referrer: parentUser ? (parentUser._id as any) : null,
    position: position || null,
    status: "active",
  });

  // Initialize binary tree and wallets
  try {
    const parentId = parentUser ? (parentUser._id as any) : null;
    const initResult = await initializeUser(user._id as any, parentId, position || undefined);
    
    // Update user's referrer and position if admin was assigned
    if (!parentUser && initResult.position) {
      const adminUser = await findUserByUserId("CROWN-000000");
      if (adminUser) {
        user.referrer = adminUser._id as any;
        user.position = initResult.position;
        await user.save();
      }
    } else if (initResult.position && !user.position) {
      user.position = initResult.position;
      await user.save();
    }
  } catch (error) {
    // If initialization fails, delete the user
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  return { userId, user };
}

/**
 * Create a binary tree branch with max depth
 * Returns array of user numbers in the branch
 */
function createBranchStructure(branchSize: number, maxDepth: number): Array<{ index: number; parentIndex: number; position: "left" | "right" | null; level: number }> {
  const branch: Array<{ index: number; parentIndex: number; position: "left" | "right" | null; level: number }> = [];
  const maxNodes = Math.min(branchSize, maxNodesInDepth(maxDepth));
  
  // Start from index 0 (which will be mapped to actual user number)
  for (let i = 0; i < maxNodes; i++) {
    const level = getNodeLevel(i);
    
    // Skip if level exceeds max depth
    if (level >= maxDepth) continue;
    
    if (i === 0) {
      // Root of branch (will be child of admin)
      branch.push({ index: i, parentIndex: -1, position: null, level: 0 });
    } else {
      const parentIndex = Math.floor((i - 1) / 2);
      const position = (i - 1) % 2 === 0 ? "right" : "left";
      branch.push({ index: i, parentIndex, position, level });
    }
  }
  
  return branch;
}

/**
 * Main function to create 50 users with max depth 5 and multiple branches from admin
 */
async function createTestUsers() {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URL);
    console.log("✅ Connected to MongoDB");

    // Check if root user exists, create if not
    const rootUserId = "CROWN-000000";
    let rootUser = await findUserByUserId(rootUserId);

    if (!rootUser) {
      console.log(`Creating root user ${rootUserId}...`);
      const result = await createTestUser(0, null, null);
      rootUser = result.user;
      console.log(`✅ Root user ${rootUserId} created`);
    } else {
      console.log(`✅ Root user ${rootUserId} already exists`);
    }

    const totalUsers = 50;
    const maxDepth = 5;
    console.log(`\n🚀 Creating ${totalUsers} users with max depth ${maxDepth}...`);
    console.log(`📋 Strategy: Multiple independent branches from admin (CROWN-000000)\n`);

    let createdCount = 0;
    let errorCount = 0;
    let userCounter = 1; // Start from 1 (0 is admin)
    const branches: Array<Array<{ userId: string; user: any }>> = [];
    
    // Create multiple branches from admin
    // Strategy: Place branch roots as children of admin's immediate children to keep them close
    const branchSizes = [8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1]; // Total = 50 users
    let branchIndex = 0;
    const branchRoots: Array<{ userId: string; user: any }> = []; // Store branch root nodes

    console.log(`\n📊 Creating ${branchSizes.length} branches from admin...\n`);

    for (const branchSize of branchSizes) {
      if (userCounter > totalUsers) break;

      const actualBranchSize = Math.min(branchSize, totalUsers - createdCount);
      if (actualBranchSize === 0) break;

      console.log(`🌿 Creating Branch ${branchIndex + 1} with ${actualBranchSize} users...`);
      
      const branchStructure = createBranchStructure(actualBranchSize, maxDepth);
      const branchUsers: Array<{ userId: string; user: any }> = [];
      const branchUserMap: { [key: number]: string } = {};

      for (const node of branchStructure) {
        if (userCounter > totalUsers) break;

        try {
          let parentUserId: string | null = null;
          let position: "left" | "right" | null = null;

          if (node.parentIndex === -1) {
            // This is the root of the branch - attach directly to admin
            // Admin can have unlimited children, so no position needed
            parentUserId = rootUserId;
            position = null; // Admin doesn't need position (unlimited children)
          } else {
            // This is a child node in the branch
            parentUserId = branchUserMap[node.parentIndex];
            position = node.position;
          }

          if (!parentUserId && node.parentIndex !== -1) {
            throw new Error(`Parent not found for branch node ${node.index}`);
        }

          const result = await createTestUser(userCounter, parentUserId, position);
          branchUserMap[node.index] = result.userId;
          branchUsers.push(result);
          createdCount++;
          userCounter++;

          // Store branch root for future branches
          if (node.parentIndex === -1) {
            branchRoots.push(result);
          }

          const positionInfo = position ? ` (${position})` : ' (auto)';
          console.log(`   ✅ Created ${result.userId} (Level ${node.level}, Parent: ${parentUserId || 'Admin'}${positionInfo})`);
      } catch (error: any) {
          errorCount++;
          console.error(`   ❌ Error creating user ${userCounter}:`, error.message);
          userCounter++; // Continue with next user
      }
    }

      branches.push(branchUsers);
      branchIndex++;
      console.log(`   ✅ Branch ${branchIndex} completed with ${branchUsers.length} users\n`);
    }

    // Final Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ TEST COMPLETED SUCCESSFULLY!`);
    console.log(`${"=".repeat(60)}\n`);
    console.log(`📊 Statistics:`);
    console.log(`   - Total users created: ${createdCount}`);
    console.log(`   - Errors encountered: ${errorCount}`);
    console.log(`   - Number of branches: ${branches.length}`);
    console.log(`   - Max depth: ${maxDepth} levels`);

    // Verify binary tree structure
    console.log(`\n🔍 Verifying binary tree structure...`);
    const binaryTrees = await BinaryTree.countDocuments();
    const wallets = await Wallet.countDocuments();
    const totalUsersInDb = await User.countDocuments();
    
    console.log(`   - Binary tree entries: ${binaryTrees}`);
    console.log(`   - Wallet entries: ${wallets} (expected: ~${totalUsersInDb * 7})`);
    console.log(`   - Total users in database: ${totalUsersInDb}`);

    // Verify admin tree structure
    const adminUser = await findUserByUserId("CROWN-000000");
    if (adminUser) {
      const adminTree = await BinaryTree.findOne({ user: adminUser._id });
      if (adminTree) {
        console.log(`\n👑 Admin (CROWN-000000) Tree Stats:`);
        console.log(`   - Left child: ${adminTree.leftChild ? "Yes" : "No"}`);
        console.log(`   - Right child: ${adminTree.rightChild ? "Yes" : "No"}`);
        console.log(`   - Left downlines: ${adminTree.leftDownlines}`);
        console.log(`   - Right downlines: ${adminTree.rightDownlines}`);
      }
    }

    // Count users under admin
    const usersUnderAdmin = await BinaryTree.countDocuments({
      parent: adminUser?._id
    });
    console.log(`   - Direct children of admin: ${usersUnderAdmin}`);

    // Calculate actual max depth
    console.log(`\n📏 Depth Analysis:`);
    let maxActualDepth = 0;
    const depthCounts: { [key: number]: number } = {};
    
    for (const branch of branches) {
      for (const branchUser of branch) {
        const tree = await BinaryTree.findOne({ user: branchUser.user._id }).populate('parent');
        if (tree && tree.parent) {
          let depth = 1;
          let currentParent = tree.parent;
          
          while (currentParent) {
            depth++;
            const parentTree = await BinaryTree.findOne({ user: currentParent }).populate('parent');
            if (parentTree && parentTree.parent && parentTree.parent.toString() !== adminUser?._id.toString()) {
              currentParent = parentTree.parent;
            } else {
              break;
            }
          }
          
          maxActualDepth = Math.max(maxActualDepth, depth);
          depthCounts[depth] = (depthCounts[depth] || 0) + 1;
        }
      }
    }
    
    console.log(`   - Maximum actual depth: ${maxActualDepth}`);
    console.log(`   - Depth distribution:`, depthCounts);

    console.log(`\n${"=".repeat(60)}`);

  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("\n✅ MongoDB connection closed");
  }
}

// Run the script
if (require.main === module) {
  createTestUsers()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export { createTestUsers };

