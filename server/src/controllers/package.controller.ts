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
    duration,
    status,
    // Legacy fields
    roi,
    binaryBonus,
    cappingLimit,
    principleReturn,
    levelOneReferral,
    // New fields
    totalOutputPct,
    binaryPct,
    powerCapacity,
    renewablePrinciplePct,
    referralPct,
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
  if (duration === undefined || duration < 1) {
    throw new AppError("Duration must be at least 1 day", 400);
  }

  // Use new fields if provided, otherwise fall back to legacy fields
  const totalOutput = totalOutputPct !== undefined ? Number(totalOutputPct) : (roi !== undefined ? Number(roi) : 225);
  const binaryPercent = binaryPct !== undefined ? Number(binaryPct) : (binaryBonus !== undefined ? Number(binaryBonus) : 10);
  const powerCap = powerCapacity !== undefined ? powerCapacity : (cappingLimit !== undefined ? cappingLimit : "0");
  const renewablePercent = renewablePrinciplePct !== undefined ? Number(renewablePrinciplePct) : (principleReturn !== undefined ? Number(principleReturn) : 50);
  const referralPercent = referralPct !== undefined ? Number(referralPct) : (levelOneReferral !== undefined ? Number(levelOneReferral) : 7);

  // Prepare package data with both new and legacy fields for compatibility
  const packageData: any = {
    packageName,
    minAmount: Types.Decimal128.fromString(minAmount.toString()),
    maxAmount: Types.Decimal128.fromString(maxAmount.toString()),
    duration: Number(duration) || 150,
    status: status || "Active",
    // New fields
    totalOutputPct: totalOutput,
    binaryPct: binaryPercent,
    powerCapacity: Types.Decimal128.fromString(powerCap.toString()),
    renewablePrinciplePct: renewablePercent,
    referralPct: referralPercent,
  };

  // Add legacy fields if provided or use defaults from new fields
  if (roi !== undefined) {
    packageData.roi = Number(roi);
  } else if (totalOutputPct === undefined) {
    packageData.roi = totalOutput;
  }

  if (binaryBonus !== undefined) {
    packageData.binaryBonus = Number(binaryBonus);
  } else if (binaryPct === undefined) {
    packageData.binaryBonus = binaryPercent;
  }

  if (cappingLimit !== undefined) {
    packageData.cappingLimit = Types.Decimal128.fromString(cappingLimit.toString());
  } else if (powerCapacity === undefined) {
    packageData.cappingLimit = Types.Decimal128.fromString(powerCap.toString());
  }

  if (principleReturn !== undefined) {
    packageData.principleReturn = Number(principleReturn);
  } else if (renewablePrinciplePct === undefined) {
    packageData.principleReturn = renewablePercent;
  }

  if (levelOneReferral !== undefined) {
    packageData.levelOneReferral = Number(levelOneReferral);
  } else if (referralPct === undefined) {
    packageData.levelOneReferral = referralPercent;
  }

  const pkg = await Package.create(packageData);

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
    duration,
    status,
    // Legacy fields
    roi,
    binaryBonus,
    cappingLimit,
    principleReturn,
    levelOneReferral,
    // New fields
    totalOutputPct,
    binaryPct,
    powerCapacity,
    renewablePrinciplePct,
    referralPct,
  } = body;

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid package ID", 400);
  }

  const pkg = await Package.findById(id);
  if (!pkg) {
    throw new AppError("Package not found", 404);
  }

  // Update basic fields
  if (packageName !== undefined) pkg.packageName = packageName;
  if (duration !== undefined) pkg.duration = Number(duration);
  if (status !== undefined) pkg.status = status;

  // Update amount fields
  if (minAmount !== undefined)
    pkg.minAmount = Types.Decimal128.fromString(minAmount.toString());
  if (maxAmount !== undefined)
    pkg.maxAmount = Types.Decimal128.fromString(maxAmount.toString());

  // Update new fields (preferred)
  if (totalOutputPct !== undefined) pkg.totalOutputPct = Number(totalOutputPct);
  if (binaryPct !== undefined) pkg.binaryPct = Number(binaryPct);
  if (powerCapacity !== undefined)
    pkg.powerCapacity = Types.Decimal128.fromString(powerCapacity.toString());
  if (renewablePrinciplePct !== undefined) pkg.renewablePrinciplePct = Number(renewablePrinciplePct);
  if (referralPct !== undefined) pkg.referralPct = Number(referralPct);

  // Update legacy fields (for backward compatibility)
  if (roi !== undefined) pkg.roi = Number(roi);
  if (binaryBonus !== undefined) pkg.binaryBonus = Number(binaryBonus);
  if (cappingLimit !== undefined)
    pkg.cappingLimit = Types.Decimal128.fromString(cappingLimit.toString());
  if (principleReturn !== undefined) pkg.principleReturn = Number(principleReturn);
  if (levelOneReferral !== undefined) pkg.levelOneReferral = Number(levelOneReferral);

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

