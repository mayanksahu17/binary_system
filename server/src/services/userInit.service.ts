import { Types } from "mongoose";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Wallet } from "../models/Wallet";
import { WalletType } from "../models/types";
import { AppError } from "../utills/AppError";
import { findUserByUserId } from "./userId.service";

/**
 * Check if a user is the admin (CROWN-000000)
 */
async function isAdminUser(userId: Types.ObjectId): Promise<boolean> {
  try {
    const user = await User.findById(userId);
    return user?.userId === "CROWN-000000";
  } catch (error) {
    return false;
  }
}

/**
 * Recursively count all users in a subtree (left or right leg)
 * This counts ALL descendants, not just direct children
 */
async function countSubtreeUsers(
  rootUserId: Types.ObjectId,
  leg: "left" | "right"
): Promise<number> {
  try {
    const rootTree = await BinaryTree.findOne({ user: rootUserId });
    if (!rootTree) {
      return 0;
    }

    const childInLeg = leg === "left" ? rootTree.leftChild : rootTree.rightChild;
    if (!childInLeg) {
      return 0;
    }

    // Count the direct child (1) plus all its descendants
    const childTree = await BinaryTree.findOne({ user: childInLeg });
    if (!childTree) {
      return 1; // Just the direct child
    }

    // Recursively count left and right subtrees of the child
    const leftCount = await countSubtreeUsers(childInLeg as Types.ObjectId, "left");
    const rightCount = await countSubtreeUsers(childInLeg as Types.ObjectId, "right");

    // Total = 1 (the child itself) + all its descendants
    return 1 + leftCount + rightCount;
  } catch (error) {
    return 0;
  }
}

/**
 * Update downline counts for a user by recursively counting all users in each leg
 */
async function updateDownlineCounts(userId: Types.ObjectId) {
  try {
    const userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree) {
      return;
    }

    // Count all users in left subtree
    const leftCount = await countSubtreeUsers(userId, "left");
    // Count all users in right subtree
    const rightCount = await countSubtreeUsers(userId, "right");

    userTree.leftDownlines = leftCount;
    userTree.rightDownlines = rightCount;
    await userTree.save();
  } catch (error) {
    console.error("Error updating downline counts:", error);
  }
}

/**
 * Recursively update downline counts for all ancestors up the tree
 * When a new user is added, we need to update counts for all parents
 */
async function updateAncestorDownlineCounts(
  userId: Types.ObjectId,
  visited: Set<string> = new Set()
) {
  try {
    const userIdStr = userId.toString();
    if (visited.has(userIdStr)) {
      return; // Avoid infinite loops
    }
    visited.add(userIdStr);

    const userTree = await BinaryTree.findOne({ user: userId });
    if (!userTree || !userTree.parent) {
      return; // No parent, we're at the root
    }

    // Update this user's downline counts
    await updateDownlineCounts(userId);

    // Recursively update parent's counts
    await updateAncestorDownlineCounts(userTree.parent as Types.ObjectId, visited);
  } catch (error) {
    console.error("Error updating ancestor downline counts:", error);
  }
}

/**
 * Initialize binary tree entry for a new user
 * Special case: If parent is admin (CROWN-000000), no binary tree constraints apply
 * All other nodes must follow binary tree rules (max 2 children: left and right)
 */
export async function initializeBinaryTree(userId: Types.ObjectId, referrerId?: Types.ObjectId | null, position?: "left" | "right" | null) {
  try {
    // Create binary tree entry
    const binaryTree = await BinaryTree.create({
      user: userId,
      parent: referrerId || null,
      leftChild: null,
      rightChild: null,
      leftBusiness: "0",
      rightBusiness: "0",
      leftCarry: "0",
      rightCarry: "0",
      leftDownlines: 0,
      rightDownlines: 0,
      matchingDue: "0",
      cappingLimit: "0",
    });

    // If referrer is provided, update referrer's tree
    if (referrerId) {
      const referrerTree = await BinaryTree.findOne({ user: referrerId });
      if (referrerTree) {
        const referrerIsAdmin = await isAdminUser(referrerId);
        
        if (referrerIsAdmin) {
          // Admin can have unlimited children - no binary tree constraints
          // Just update downlines count (we'll use leftDownlines to track total children for admin)
          // For admin, count all direct children
          const adminChildren = await BinaryTree.countDocuments({ parent: referrerId });
          referrerTree.leftDownlines = adminChildren;
          await referrerTree.save();
        } else {
          // For non-admin parents, enforce binary tree rules (left/right only)
        if (position === "left") {
            if (referrerTree.leftChild) {
              throw new AppError("Left position already occupied. Binary tree constraint violated.", 400);
            }
          referrerTree.leftChild = userId;
            // Update downline count by counting all users in left subtree
            await referrerTree.save();
            await updateDownlineCounts(referrerId);
        } else if (position === "right") {
            if (referrerTree.rightChild) {
              throw new AppError("Right position already occupied. Binary tree constraint violated.", 400);
            }
          referrerTree.rightChild = userId;
            // Update downline count by counting all users in right subtree
        await referrerTree.save();
            await updateDownlineCounts(referrerId);
          } else {
            throw new AppError("Position (left or right) is required for non-admin parents.", 400);
          }
        }

        // Update downline counts for all ancestors up the tree
        // This ensures that when a user is placed deeper in the tree, all ancestors' counts are updated
        await updateAncestorDownlineCounts(referrerId);
      }
    }

    return binaryTree;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to initialize binary tree", 500);
  }
}

/**
 * Initialize default wallets for a new user
 */
export async function initializeWallets(userId: Types.ObjectId) {
  try {
    const defaultWallets = [
      { type: WalletType.WITHDRAWAL, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.ROI, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.INTEREST, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.REFERRAL, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.BINARY, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.TOKEN, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.INVESTMENT, balance: "0", reserved: "0", currency: "USD" },
      { type: WalletType.CAREER_LEVEL, balance: "0", reserved: "0", currency: "USD" },
    ];

    const wallets = await Promise.all(
      defaultWallets.map((wallet) =>
        Wallet.create({
          user: userId,
          ...wallet,
        })
      )
    );

    return wallets;
  } catch (error) {
    throw new AppError("Failed to initialize wallets", 500);
  }
}

/**
 * Find the next available position for a user in the binary tree
 * Special case: If referrer is admin, return null (admin can have unlimited children, no position needed)
 * For non-admin referrers, finds the first available left or right position
 */
export async function findAvailablePosition(referrerId: Types.ObjectId): Promise<"left" | "right" | null> {
  try {
    const referrerIsAdmin = await isAdminUser(referrerId);
    
    // Admin can have unlimited children - no position constraint
    if (referrerIsAdmin) {
      return null; // No position needed for admin children
    }

    const referrerTree = await BinaryTree.findOne({ user: referrerId });
    if (!referrerTree) {
      return null;
    }

    // For non-admin: enforce binary tree rules
    // If left is available, return left
    if (!referrerTree.leftChild) {
      return "left";
    }

    // If right is available, return right
    if (!referrerTree.rightChild) {
      return "right";
    }

    // Both positions are filled, return null (should find next available position in downline)
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Find the deepest available position in a specific leg (left or right) of the tree
 * This function traverses down the specified leg until it finds an empty slot
 * 
 * Algorithm:
 * 1. If the requested position at root is available, return it
 * 2. If occupied, go to the child in that leg
 * 3. Recursively check that child's same position (continues down the leg)
 * 
 * Example: 
 * - A has B (right) and C (left)
 * - A refers D in "right" -> D goes to B's right position (B is in A's right, D goes to B's right)
 * - B refers E in "right" -> E goes to D's right position (D is in B's right, E goes to D's right)
 */
export async function findDeepestAvailablePositionInLeg(
  rootUserId: Types.ObjectId,
  requestedPosition: "left" | "right"
): Promise<{ parentId: Types.ObjectId; position: "left" | "right" } | null> {
  try {
    const rootTree = await BinaryTree.findOne({ user: rootUserId });
    if (!rootTree) {
      return null;
    }

    // Check if the requested position is available at the root
    if (requestedPosition === "left" && !rootTree.leftChild) {
      return { parentId: rootUserId, position: "left" };
    }
    if (requestedPosition === "right" && !rootTree.rightChild) {
      return { parentId: rootUserId, position: "right" };
    }

    // The requested position is occupied, get the child in that leg
    const childInRequestedLeg = requestedPosition === "left" 
      ? rootTree.leftChild 
      : rootTree.rightChild;

    if (!childInRequestedLeg) {
      return null;
    }

    // First, check if the child itself has the requested position available
    // Example: A refers in "right", B is in A's right, check if B's right is available
    const childTree = await BinaryTree.findOne({ user: childInRequestedLeg });
    if (childTree) {
      const childPositionAvailable = requestedPosition === "left"
        ? !childTree.leftChild
        : !childTree.rightChild;

      if (childPositionAvailable) {
        return { parentId: childInRequestedLeg as Types.ObjectId, position: requestedPosition };
      }
    }

    // Child's position is also occupied, recursively go deeper
    // This continues down the tree in the same direction
    const result = await findDeepestAvailablePositionInLeg(
      childInRequestedLeg as Types.ObjectId,
      requestedPosition
    );

    if (result) {
      return result;
    }

    // No available position found in the requested leg
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Recursively find the next available position in a binary tree
 * This will traverse the tree to find the first available slot
 * Used when no specific position is requested
 */
export async function findNextAvailablePositionInTree(
  rootUserId: Types.ObjectId,
  visited: Set<string> = new Set()
): Promise<{ parentId: Types.ObjectId; position: "left" | "right" } | null> {
  try {
    const rootTree = await BinaryTree.findOne({ user: rootUserId });
    if (!rootTree) {
      return null;
    }

    // Mark this node as visited to avoid infinite loops
    const rootIdStr = rootUserId.toString();
    if (visited.has(rootIdStr)) {
      return null;
    }
    visited.add(rootIdStr);

    // Check if left position is available
    if (!rootTree.leftChild) {
      return { parentId: rootUserId, position: "left" };
    }

    // Check if right position is available
    if (!rootTree.rightChild) {
      return { parentId: rootUserId, position: "right" };
    }

    // Both positions are filled, check left subtree first
    if (rootTree.leftChild) {
      const leftResult = await findNextAvailablePositionInTree(
        rootTree.leftChild as Types.ObjectId,
        visited
      );
      if (leftResult) {
        return leftResult;
      }
    }

    // If left subtree is full, check right subtree
    if (rootTree.rightChild) {
      const rightResult = await findNextAvailablePositionInTree(
        rootTree.rightChild as Types.ObjectId,
        visited
      );
      if (rightResult) {
        return rightResult;
      }
    }

    // No available position found
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get or create admin user (CROWN-000000)
 * This is the root node that all users without sponsors will be attached to
 */
export async function getAdminUser(): Promise<Types.ObjectId | null> {
  try {
    const adminUser = await findUserByUserId("CROWN-000000");
    if (!adminUser) {
      throw new AppError("Admin user (CROWN-000000) not found. Please create admin user first.", 500);
    }
    return adminUser._id as Types.ObjectId;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    return null;
  }
}

/**
 * Complete user initialization: binary tree + wallets
 * If no referrer is provided, the user will be placed under admin (CROWN-000000)
 * Exception: If the user being initialized IS the admin (CROWN-000000), they will have no parent
 */
export async function initializeUser(userId: Types.ObjectId, referrerId?: Types.ObjectId | null, position?: "left" | "right" | null) {
  try {
    // Check if this user is the admin user (CROWN-000000)
    const user = await User.findById(userId);
    const userIsAdmin = user?.userId === "CROWN-000000";

    let finalReferrerId = referrerId;
    let finalPosition = position;

    // If this is the admin user, they should have no parent
    if (userIsAdmin) {
      finalReferrerId = null;
      finalPosition = null;
    } else if (!finalReferrerId) {
      // If no referrer is provided and this is NOT admin, assign admin (CROWN-000000) as the parent
      const adminId = await getAdminUser();
      if (!adminId) {
        throw new AppError("Failed to find admin user. Cannot initialize user without referrer.", 500);
      }
      finalReferrerId = adminId;
      // Admin can have unlimited children - no position needed
      finalPosition = null;
    } else {
      // If referrer is provided, check if it's admin
      const referrerIsAdmin = await isAdminUser(finalReferrerId);
      
      if (referrerIsAdmin) {
        // Admin can have unlimited children - no position needed
        finalPosition = null;
      } else {
        // For non-admin referrers, enforce binary tree rules
        if (!finalPosition) {
          // No position specified, find any available position
          finalPosition = await findAvailablePosition(finalReferrerId);
          if (!finalPosition) {
            // If direct positions are full, find next available in the referrer's tree
            const availablePosition = await findNextAvailablePositionInTree(finalReferrerId);
            if (availablePosition) {
              finalReferrerId = availablePosition.parentId;
              finalPosition = availablePosition.position;
            } else {
              throw new AppError("No available position in referrer's binary tree.", 500);
            }
          }
        } else {
          // Position is specified (left or right)
          // Check if the direct position is available
          const referrerTree = await BinaryTree.findOne({ user: finalReferrerId });
          if (referrerTree) {
            const directPositionAvailable = finalPosition === "left" 
              ? !referrerTree.leftChild 
              : !referrerTree.rightChild;

            if (!directPositionAvailable) {
              // Direct position is occupied, find the deepest available position in that leg
              const availablePosition = await findDeepestAvailablePositionInLeg(
                finalReferrerId,
                finalPosition
              );
              
              if (availablePosition) {
                finalReferrerId = availablePosition.parentId;
                finalPosition = availablePosition.position;
              } else {
                throw new AppError(
                  `No available position in the ${finalPosition} leg of referrer's binary tree.`,
                  500
                );
              }
            }
          }
        }
      }
    }

    // Initialize binary tree
    await initializeBinaryTree(userId, finalReferrerId, finalPosition || undefined);

    // Initialize wallets
    await initializeWallets(userId);

    return { position: finalPosition };
  } catch (error) {
    // If initialization fails, we should rollback user creation
    // For now, we'll throw the error and let the caller handle it
    throw error;
  }
}

