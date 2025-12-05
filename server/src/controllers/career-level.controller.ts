import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { CareerLevel } from "../models/CareerLevel";
import { UserCareerProgress } from "../models/UserCareerProgress";
import { Types } from "mongoose";
import { getUserCareerProgress } from "../services/career-level.service";

/**
 * Get all career levels
 * GET /api/v1/admin/career-levels
 */
export const getAllCareerLevels = asyncHandler(async (req, res) => {
  const levels = await CareerLevel.find({}).sort({ level: 1 }).lean();

  const formattedLevels = levels.map((level) => ({
    id: level._id,
    name: level.name,
    investmentThreshold: parseFloat(level.investmentThreshold.toString()),
    rewardAmount: parseFloat(level.rewardAmount.toString()),
    level: level.level,
    status: level.status,
    description: level.description,
    createdAt: level.createdAt,
    updatedAt: level.updatedAt,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      levels: formattedLevels,
    },
  });
});

/**
 * Get career level by ID
 * GET /api/v1/admin/career-levels/:id
 */
export const getCareerLevelById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const level = await CareerLevel.findById(id);
  if (!level) {
    throw new AppError("Career level not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      level: {
        id: level._id,
        name: level.name,
        investmentThreshold: parseFloat(level.investmentThreshold.toString()),
        rewardAmount: parseFloat(level.rewardAmount.toString()),
        level: level.level,
        status: level.status,
        description: level.description,
        createdAt: level.createdAt,
        updatedAt: level.updatedAt,
      },
    },
  });
});

/**
 * Create a new career level
 * POST /api/v1/admin/career-levels
 */
export const createCareerLevel = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { name, investmentThreshold, rewardAmount, level, status, description } = body;

  // Validation
  if (!name || !investmentThreshold || !rewardAmount || !level) {
    throw new AppError("Name, investment threshold, reward amount, and level are required", 400);
  }

  if (investmentThreshold <= 0 || rewardAmount < 0) {
    throw new AppError("Investment threshold must be positive and reward amount must be non-negative", 400);
  }

  if (level < 1) {
    throw new AppError("Level must be at least 1", 400);
  }

  // Check if level number already exists
  const existingLevel = await CareerLevel.findOne({ level });
  if (existingLevel) {
    throw new AppError(`Career level with level number ${level} already exists`, 409);
  }

  // Check if name already exists
  const existingName = await CareerLevel.findOne({ name: name.trim() });
  if (existingName) {
    throw new AppError(`Career level with name "${name}" already exists`, 409);
  }

  const careerLevel = await CareerLevel.create({
    name: name.trim(),
    investmentThreshold: Types.Decimal128.fromString(investmentThreshold.toString()),
    rewardAmount: Types.Decimal128.fromString(rewardAmount.toString()),
    level: parseInt(level),
    status: status || "Active",
    description: description?.trim() || undefined,
  });

  const response = res as any;
  response.status(201).json({
    status: "success",
    message: "Career level created successfully",
    data: {
      level: {
        id: careerLevel._id,
        name: careerLevel.name,
        investmentThreshold: parseFloat(careerLevel.investmentThreshold.toString()),
        rewardAmount: parseFloat(careerLevel.rewardAmount.toString()),
        level: careerLevel.level,
        status: careerLevel.status,
        description: careerLevel.description,
      },
    },
  });
});

/**
 * Update a career level
 * PUT /api/v1/admin/career-levels/:id
 */
export const updateCareerLevel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = (req as any).body;
  const { name, investmentThreshold, rewardAmount, level, status, description } = body;

  const careerLevel = await CareerLevel.findById(id);
  if (!careerLevel) {
    throw new AppError("Career level not found", 404);
  }

  // Validation
  if (investmentThreshold !== undefined && investmentThreshold <= 0) {
    throw new AppError("Investment threshold must be positive", 400);
  }

  if (rewardAmount !== undefined && rewardAmount < 0) {
    throw new AppError("Reward amount must be non-negative", 400);
  }

  if (level !== undefined && level < 1) {
    throw new AppError("Level must be at least 1", 400);
  }

  // Check if level number already exists (if changing level)
  if (level !== undefined && level !== careerLevel.level) {
    const existingLevel = await CareerLevel.findOne({ level });
    if (existingLevel) {
      throw new AppError(`Career level with level number ${level} already exists`, 409);
    }
  }

  // Check if name already exists (if changing name)
  if (name !== undefined && name.trim() !== careerLevel.name) {
    const existingName = await CareerLevel.findOne({ name: name.trim() });
    if (existingName) {
      throw new AppError(`Career level with name "${name}" already exists`, 409);
    }
  }

  // Update fields
  if (name !== undefined) careerLevel.name = name.trim();
  if (investmentThreshold !== undefined)
    careerLevel.investmentThreshold = Types.Decimal128.fromString(investmentThreshold.toString());
  if (rewardAmount !== undefined)
    careerLevel.rewardAmount = Types.Decimal128.fromString(rewardAmount.toString());
  if (level !== undefined) careerLevel.level = parseInt(level);
  if (status !== undefined) careerLevel.status = status;
  if (description !== undefined) careerLevel.description = description?.trim() || undefined;

  await careerLevel.save();

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Career level updated successfully",
    data: {
      level: {
        id: careerLevel._id,
        name: careerLevel.name,
        investmentThreshold: parseFloat(careerLevel.investmentThreshold.toString()),
        rewardAmount: parseFloat(careerLevel.rewardAmount.toString()),
        level: careerLevel.level,
        status: careerLevel.status,
        description: careerLevel.description,
      },
    },
  });
});

/**
 * Delete a career level
 * DELETE /api/v1/admin/career-levels/:id
 */
export const deleteCareerLevel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const careerLevel = await CareerLevel.findById(id);
  if (!careerLevel) {
    throw new AppError("Career level not found", 404);
  }

  await CareerLevel.deleteOne({ _id: id });

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Career level deleted successfully",
  });
});

/**
 * Get user's career progress (Admin)
 * GET /api/v1/admin/career-progress/:userId
 */
export const getUserCareerProgressAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await import("../models/User").then((m) => m.User.findOne({ userId }));
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const progress = await getUserCareerProgress(user._id as Types.ObjectId);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      progress: progress || {
        currentLevel: null,
        currentLevelName: null,
        levelInvestment: 0,
        totalBusinessVolume: 0,
        completedLevels: [],
        totalRewardsEarned: 0,
        lastCheckedAt: null,
      },
    },
  });
});

/**
 * Get all users' career progress (Admin)
 * GET /api/v1/admin/career-progress
 */
export const getAllUsersCareerProgress = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const progressList = await UserCareerProgress.find({})
    .populate("user", "userId name email")
    .populate("currentLevel")
    .sort({ totalBusinessVolume: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await UserCareerProgress.countDocuments({});

  const formattedProgress = progressList.map((progress) => ({
    userId: (progress.user as any)?.userId,
    userName: (progress.user as any)?.name,
    userEmail: (progress.user as any)?.email,
    currentLevel: progress.currentLevel
      ? {
          id: (progress.currentLevel as any)._id,
          name: (progress.currentLevel as any).name,
          level: (progress.currentLevel as any).level,
          investmentThreshold: parseFloat((progress.currentLevel as any).investmentThreshold.toString()),
          rewardAmount: parseFloat((progress.currentLevel as any).rewardAmount.toString()),
        }
      : null,
    currentLevelName: progress.currentLevelName,
    levelInvestment: parseFloat(progress.levelInvestment.toString()),
    totalBusinessVolume: parseFloat(progress.totalBusinessVolume.toString()),
    completedLevelsCount: progress.completedLevels.length,
    totalRewardsEarned: parseFloat(progress.totalRewardsEarned.toString()),
    lastCheckedAt: progress.lastCheckedAt,
  }));

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      progress: formattedProgress,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

