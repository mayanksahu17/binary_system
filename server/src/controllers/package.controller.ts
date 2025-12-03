import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { Package } from "../models/Package";
import { Types } from "mongoose";

/**
 * Get all packages
 * GET /api/v1/admin/packages
 */
export const getAllPackages = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;

  const query: any = {};
  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const packages = await Package.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Package.countDocuments(query);

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      packages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

/**
 * Get single package by ID
 * GET /api/v1/admin/packages/:id
 */
export const getPackageById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid package ID", 400);
  }

  const pkg = await Package.findById(id);
  if (!pkg) {
    throw new AppError("Package not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      package: pkg,
    },
  });
});

/**
 * Create new package
 * POST /api/v1/admin/packages
 */
export const createPackage = asyncHandler(async (req, res) => {
  const body = req.body;
  const {
    packageName,
    minAmount,
    maxAmount,
    roi,
    duration,
    binaryBonus,
    cappingLimit,
    principleReturn,
    levelOneReferral,
    status,
  } = body;

  // Validation
  if (!packageName) {
    throw new AppError("Package name is required", 400);
  }
  if (!minAmount || !maxAmount) {
    throw new AppError("Min and max amounts are required", 400);
  }
  if (parseFloat(minAmount) >= parseFloat(maxAmount)) {
    throw new AppError("Max amount must be greater than min amount", 400);
  }
  if (roi === undefined || roi < 0) {
    throw new AppError("ROI must be a positive number", 400);
  }
  if (duration === undefined || duration < 1) {
    throw new AppError("Duration must be at least 1 day", 400);
  }

  // Create package
  const pkg = await Package.create({
    packageName,
    minAmount: Types.Decimal128.fromString(minAmount.toString()),
    maxAmount: Types.Decimal128.fromString(maxAmount.toString()),
    roi: Number(roi) || 0,
    duration: Number(duration) || 0,
    binaryBonus: Number(binaryBonus) || 0,
    cappingLimit: cappingLimit
      ? Types.Decimal128.fromString(cappingLimit.toString())
      : Types.Decimal128.fromString("0"),
    principleReturn: Number(principleReturn) || 0,
    levelOneReferral: Number(levelOneReferral) || 0,
    status: status || "Active",
  });

  const response = res as any;
  response.status(201).json({
    status: "success",
    message: "Package created successfully",
    data: {
      package: pkg,
    },
  });
});

/**
 * Update package
 * PUT /api/v1/admin/packages/:id
 */
export const updatePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const {
    packageName,
    minAmount,
    maxAmount,
    roi,
    duration,
    binaryBonus,
    cappingLimit,
    principleReturn,
    levelOneReferral,
    status,
  } = body;

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid package ID", 400);
  }

  const pkg = await Package.findById(id);
  if (!pkg) {
    throw new AppError("Package not found", 404);
  }

  // Update fields
  if (packageName !== undefined) pkg.packageName = packageName;
  if (minAmount !== undefined)
    pkg.minAmount = Types.Decimal128.fromString(minAmount.toString());
  if (maxAmount !== undefined)
    pkg.maxAmount = Types.Decimal128.fromString(maxAmount.toString());
  if (roi !== undefined) pkg.roi = Number(roi);
  if (duration !== undefined) pkg.duration = Number(duration);
  if (binaryBonus !== undefined) pkg.binaryBonus = Number(binaryBonus);
  if (cappingLimit !== undefined)
    pkg.cappingLimit = Types.Decimal128.fromString(cappingLimit.toString());
  if (principleReturn !== undefined) pkg.principleReturn = Number(principleReturn);
  if (levelOneReferral !== undefined) pkg.levelOneReferral = Number(levelOneReferral);
  if (status !== undefined) pkg.status = status;

  // Validate min/max if both are being updated
  if (minAmount !== undefined || maxAmount !== undefined) {
    const min = minAmount !== undefined ? parseFloat(minAmount.toString()) : parseFloat(pkg.minAmount.toString());
    const max = maxAmount !== undefined ? parseFloat(maxAmount.toString()) : parseFloat(pkg.maxAmount.toString());
    if (min >= max) {
      throw new AppError("Max amount must be greater than min amount", 400);
    }
  }

  await pkg.save();

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Package updated successfully",
    data: {
      package: pkg,
    },
  });
});

/**
 * Delete package
 * DELETE /api/v1/admin/packages/:id
 */
export const deletePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid package ID", 400);
  }

  const pkg = await Package.findByIdAndDelete(id);
  if (!pkg) {
    throw new AppError("Package not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    message: "Package deleted successfully",
  });
});

