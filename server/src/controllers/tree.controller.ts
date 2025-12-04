import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { User } from "../models/User";
import { BinaryTree } from "../models/BinaryTree";
import { Investment } from "../models/Investment";
import { Types } from "mongoose";

/**
 * Get entire binary tree structure as JSON
 * GET /api/v1/tree/view
 */
export const viewBinaryTree = asyncHandler(async (req, res) => {
  // Fetch all users with their binary tree data
  const users = await User.find({}).select("userId name email phone status referrer position").lean();
  const binaryTrees = await BinaryTree.find({})
    .populate("user", "userId name")
    .populate("parent", "userId name")
    .populate("leftChild", "userId name")
    .populate("rightChild", "userId name")
    .lean();

  // Create a map for quick lookup
  const userMap = new Map();
  users.forEach((user: any) => {
    userMap.set(user._id.toString(), {
      id: user._id.toString(),
      userId: user.userId || "N/A",
      name: user.name || "Unknown",
      email: user.email || "",
      phone: user.phone || "",
      status: user.status,
      referrer: user.referrer?.toString() || null,
      position: user.position,
    });
  });

  const treeMap = new Map();
  binaryTrees.forEach((tree: any) => {
    const userId = tree.user?._id?.toString() || tree.user?.toString();
    treeMap.set(userId, {
      userId: tree.user?.userId || tree.user?.toString(),
      userName: tree.user?.name || "Unknown",
      parent: tree.parent?._id?.toString() || tree.parent?.toString() || null,
      parentUserId: tree.parent?.userId || null,
      parentName: tree.parent?.name || null,
      leftChild: tree.leftChild?._id?.toString() || tree.leftChild?.toString() || null,
      leftChildUserId: tree.leftChild?.userId || null,
      rightChild: tree.rightChild?._id?.toString() || tree.rightChild?.toString() || null,
      rightChildUserId: tree.rightChild?.userId || null,
      leftBusiness: tree.leftBusiness?.toString() || "0",
      rightBusiness: tree.rightBusiness?.toString() || "0",
      leftCarry: tree.leftCarry?.toString() || "0",
      rightCarry: tree.rightCarry?.toString() || "0",
      leftMatched: tree.leftMatched?.toString() || "0",
      rightMatched: tree.rightMatched?.toString() || "0",
      leftDownlines: tree.leftDownlines || 0,
      rightDownlines: tree.rightDownlines || 0,
    });
  });

  // Build tree structure
  const treeData: any[] = [];
  
  // First, find all admin children (if admin exists)
  const adminUser = users.find((u: any) => {
    const userInfo = userMap.get(u._id.toString());
    return userInfo?.userId === "CROWN-000000";
  });
  
  let adminChildrenMap = new Map<string, string[]>();
  if (adminUser) {
    const adminChildren = await BinaryTree.find({ parent: adminUser._id })
      .populate("user", "userId")
      .lean();
    const adminChildrenIds = adminChildren.map((child: any) => 
      child.user?._id?.toString() || child.user?.toString()
    );
    adminChildrenMap.set(adminUser._id.toString(), adminChildrenIds);
  }
  
  users.forEach((user: any) => {
    const userId = user._id.toString();
    const treeInfo = treeMap.get(userId);
    const userInfo = userMap.get(userId);

    if (userInfo) {
      // Check if this is admin (CROWN-000000)
      const isAdmin = userInfo.userId === "CROWN-000000";
      
      // For admin, get all children (not just left/right)
      let allChildren: string[] = [];
      if (isAdmin) {
        allChildren = adminChildrenMap.get(userId) || [];
      } else {
        // For non-admin, use left/right children
        if (treeInfo?.leftChild) allChildren.push(treeInfo.leftChild);
        if (treeInfo?.rightChild) allChildren.push(treeInfo.rightChild);
      }

      treeData.push({
        ...userInfo,
        ...treeInfo,
        // Properly parse Decimal128 values to numbers, then convert to string for consistency
        leftBusiness: parseFloat(treeInfo?.leftBusiness?.toString() || "0").toString(),
        rightBusiness: parseFloat(treeInfo?.rightBusiness?.toString() || "0").toString(),
        leftCarry: parseFloat(treeInfo?.leftCarry?.toString() || "0").toString(),
        rightCarry: parseFloat(treeInfo?.rightCarry?.toString() || "0").toString(),
        leftDownlines: treeInfo?.leftDownlines || 0,
        rightDownlines: treeInfo?.rightDownlines || 0,
        // Add all children for admin, or keep left/right for others
        allChildren: isAdmin ? allChildren : [],
        // Keep leftChild and rightChild for compatibility
        leftChild: treeInfo?.leftChild || null,
        rightChild: treeInfo?.rightChild || null,
        // Include matched fields for display (optional, for debugging)
        leftMatched: parseFloat(treeInfo?.leftMatched?.toString() || "0").toString(),
        rightMatched: parseFloat(treeInfo?.rightMatched?.toString() || "0").toString(),
      });
    }
  });

  // Calculate statistics
  const totalUsers = treeData.length;
  const activeUsers = treeData.filter((u: any) => u.status === "active").length;
  const totalDownlines = treeData.reduce(
    (sum: number, u: any) => sum + (u.leftDownlines || 0) + (u.rightDownlines || 0),
    0
  );

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      tree: treeData,
      statistics: {
        totalUsers,
        activeUsers,
        totalDownlines,
      },
    },
  });
});

/**
 * Get user's downline tree (starting from user's node)
 * GET /api/v1/tree/my-tree
 */
export const getMyTree = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  // Get current user
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    throw new AppError("User not found", 404);
  }

  // Get user's binary tree
  const userTree = await BinaryTree.findOne({ user: userId });
  if (!userTree) {
    throw new AppError("Binary tree not found", 404);
  }

  // Build tree starting from current user
  const treeData: any[] = [];
  const processed = new Set<string>();
  const userMap = new Map();
  const treeMap = new Map();

  // Recursive function to build tree from a node
  const buildTreeFromNode = async (nodeUserId: Types.ObjectId, level: number = 0) => {
    const nodeIdStr = nodeUserId.toString();
    if (processed.has(nodeIdStr)) return;

    const nodeUser = await User.findById(nodeUserId).select("userId name email phone status").lean();
    if (!nodeUser) return;

    const nodeTree = await BinaryTree.findOne({ user: nodeUserId })
      .populate("parent", "userId name")
      .populate("leftChild", "userId name")
      .populate("rightChild", "userId name")
      .lean();

    if (!nodeTree) return;

    processed.add(nodeIdStr);

    // Get all children (for admin) or left/right children (for others)
    const isAdmin = (nodeUser as any).userId === "CROWN-000000";
    let children: string[] = [];

    if (isAdmin) {
      const adminChildren = await BinaryTree.find({ parent: nodeUserId })
        .populate("user", "userId")
        .lean();
      children = adminChildren.map((child: any) => 
        child.user?._id?.toString() || child.user?.toString()
      );
    } else {
      if (nodeTree.leftChild) {
        const leftChildId = (nodeTree.leftChild as any)?._id?.toString() || (nodeTree.leftChild as any)?.toString();
        if (leftChildId) children.push(leftChildId);
      }
      if (nodeTree.rightChild) {
        const rightChildId = (nodeTree.rightChild as any)?._id?.toString() || (nodeTree.rightChild as any)?.toString();
        if (rightChildId) children.push(rightChildId);
      }
    }

    // Calculate total investment for this user
    const investments = await Investment.find({ user: nodeUserId }).select("investedAmount").lean();
    const totalInvestmentAmount = investments.reduce((sum, inv) => {
      return sum + parseFloat(inv.investedAmount?.toString() || "0");
    }, 0);

    treeData.push({
      id: nodeIdStr,
      userId: (nodeUser as any).userId || "N/A",
      name: (nodeUser as any).name || "Unknown",
      email: (nodeUser as any).email || "",
      phone: (nodeUser as any).phone || "",
      status: (nodeUser as any).status,
      parent: (nodeTree.parent as any)?._id?.toString() || (nodeTree.parent as any)?.toString() || null,
      parentUserId: (nodeTree.parent as any)?.userId || null,
      parentName: (nodeTree.parent as any)?.name || null,
      leftChild: (nodeTree.leftChild as any)?._id?.toString() || (nodeTree.leftChild as any)?.toString() || null,
      leftChildUserId: (nodeTree.leftChild as any)?.userId || null,
      rightChild: (nodeTree.rightChild as any)?._id?.toString() || (nodeTree.rightChild as any)?.toString() || null,
      rightChildUserId: (nodeTree.rightChild as any)?.userId || null,
      leftBusiness: parseFloat(nodeTree.leftBusiness?.toString() || "0").toString(),
      rightBusiness: parseFloat(nodeTree.rightBusiness?.toString() || "0").toString(),
      leftCarry: parseFloat(nodeTree.leftCarry?.toString() || "0").toString(),
      rightCarry: parseFloat(nodeTree.rightCarry?.toString() || "0").toString(),
      leftDownlines: nodeTree.leftDownlines || 0,
      rightDownlines: nodeTree.rightDownlines || 0,
      allChildren: children,
      level,
      totalInvestment: totalInvestmentAmount.toString(),
    });

    // Recursively process children
    for (const childId of children) {
      await buildTreeFromNode(new Types.ObjectId(childId), level + 1);
    }
  };

  // Start building from current user
  await buildTreeFromNode(userId, 0);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      tree: treeData,
      rootUserId: currentUser.userId,
      rootName: currentUser.name,
    },
  });
});
