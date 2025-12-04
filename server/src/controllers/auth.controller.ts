import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { signAuthToken } from "../utills/jwt";
import { User } from "../models/User";
import { initializeUser } from "../services/userInit.service";
import { generateNextUserId, findUserByUserId } from "../services/userId.service";
import { sendSignupWelcomeEmail } from "../lib/mail-service/email.service";
import { generateLoginToken, validateLoginToken } from "../services/login-token.service";

/**
 * User Signup
 * POST /api/v1/auth/signup
 */
export const userSignup = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { name, email, phone, password, referrerId, referrerUserId, position } = body as {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    referrerId?: string; // MongoDB _id
    referrerUserId?: string; // CROWN-XXXXXX format
    position?: "left" | "right";
  };
  console.table({ name, email, phone, password, referrerId, referrerUserId, position });
  // Validation
  if (!name || !password) {
    throw new AppError("Name and password are required", 400);
  }

  // At least one of email or phone is required
  if (!email && !phone) {
    throw new AppError("Either email or phone number is required", 400);
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400);
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError("Invalid email format", 400);
    }

    // Check if user with email already exists
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      throw new AppError("User with this email already exists", 409);
    }
  }

  // Check if user with phone already exists
  if (phone) {
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      throw new AppError("User with this phone number already exists", 409);
    }
  }

  // Validate referrer if provided (can use either referrerId or referrerUserId)
  // referrerId can be either MongoDB ObjectId or userId (CROWN-XXXXXX format)
  let referrer = null;
  if (referrerUserId) {
    // Lookup by userId (CROWN-XXXXXX format)
    referrer = await findUserByUserId(referrerUserId);
    if (!referrer) {
      throw new AppError(`Invalid referrer userId: ${referrerUserId}`, 400);
    }
    if (referrer.status !== "active") {
      throw new AppError("Referrer account is not active", 400);
    }
  } else if (referrerId) {
    // Check if referrerId is a userId format (CROWN-XXXXXX) or MongoDB ObjectId
    if (typeof referrerId === 'string' && referrerId.startsWith('CROWN-')) {
      // It's a userId format, use findUserByUserId
      referrer = await findUserByUserId(referrerId);
      if (!referrer) {
        throw new AppError(`Invalid referrer userId: ${referrerId}`, 400);
      }
    } else {
      // It's a MongoDB ObjectId, use findById
    referrer = await User.findById(referrerId);
    if (!referrer) {
      throw new AppError("Invalid referrer ID", 400);
      }
    }
    if (referrer.status !== "active") {
      throw new AppError("Referrer account is not active", 400);
    }
  }

  // Validate position if provided
  // Exception: If referrer is admin (CROWN-000000), position is not required
  const referrerIsAdmin = referrer?.userId === "CROWN-000000";
  
  if (position && !["left", "right"].includes(position)) {
    throw new AppError("Position must be either 'left' or 'right'", 400);
  }
  
  // If referrer is admin, position is optional (admin can have unlimited children)
  let finalPosition: "left" | "right" | null | undefined = position;
  if (referrerIsAdmin && position) {
    // Position is optional for admin children, but if provided, it will be ignored
    // Admin children don't use left/right positions
    finalPosition = null;
  }
  
  // If referrer is NOT admin and position is not provided, it will be auto-assigned
  // If referrer is NOT admin and both positions are filled, system will find next available

  // Generate userId in format CROWN-XXXXXX
  const userId = await generateNextUserId();

  // Create user
  const user = await User.create({
    userId,
    name,
    email: email ? email.toLowerCase() : undefined,
    phone: phone || undefined,
    password,
    referrer: referrer?._id || null,
    position: finalPosition || null,
    status: "active",
  });

  // Initialize binary tree and wallets
  try {
    const referrerId = referrer ? (referrer._id as any) : null;
    const initResult = await initializeUser(user._id as any, referrerId, finalPosition || undefined);
    
    // If no referrer was provided but admin was assigned, update user's referrer and position
    if (!referrer && initResult.position) {
      const adminUser = await findUserByUserId("CROWN-000000");
      if (adminUser) {
        user.referrer = adminUser._id as any;
        user.position = initResult.position;
        await user.save();
      }
    } else if (initResult.position && !user.position) {
      // Update position if it was determined during initialization
      user.position = initResult.position;
      await user.save();
    }
  } catch (error) {
    // If initialization fails, delete the user
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  // Generate JWT token
  const token = signAuthToken({
    sub: user._id.toString(),
    role: "buyer", // Default role for users
  });

  // Set token in cookie
  const response = res as any;
  response.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Send welcome email with login link if user has email
  if (user.email) {
    try {
      // Generate temporary login token (stored in Redis)
      const tempToken = await generateLoginToken(user.userId, user._id.toString());
      
      // Generate login link URL with temporary token
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginLink = `${clientUrl}/login-link?token=${tempToken}`;

      // Send email asynchronously (don't wait for it)
      sendSignupWelcomeEmail({
        to: user.email,
        name: user.name,
        userId: user.userId,
        loginLink,
      }).catch((error) => {
        // Log error but don't fail signup if email fails
        console.error('Failed to send signup welcome email:', error);
      });
    } catch (error) {
      // Log error but don't fail signup if email fails
      console.error('Error preparing signup welcome email:', error);
    }
  }

  response.status(201).json({
    status: "success",
    message: "User created successfully",
    data: {
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        referrer: user.referrer,
        position: user.position,
        status: user.status,
      },
      token,
    },
  });
});

/**
 * User Login
 * POST /api/v1/auth/login
 */
export const userLogin = asyncHandler(async (req, res) => {
  const body = (req as any).body;
  const { email, phone, userId, password } = body as {
    email?: string;
    phone?: string;
    userId?: string;
    password: string;
  };

  // Validation
  if (!password) {
    throw new AppError("Password is required", 400);
  }

  if (!email && !phone && !userId) {
    throw new AppError("Either email, phone number, or userId is required", 400);
  }

  // Find user by email, phone, or userId
  let user;
  if (userId) {
    // Login with userId (CROWN-XXXXXX format)
    user = await findUserByUserId(userId);
  } else if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
  } else if (phone) {
    user = await User.findOne({ phone });
  }

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  // Check if user account is active
  if (user.status !== "active") {
    throw new AppError(`Account is ${user.status}. Please contact support.`, 403);
  }

  // Verify password
  if (!user.password) {
    throw new AppError("Invalid credentials", 401);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401);
  }

  // Generate JWT token
  const token = signAuthToken({
    sub: user._id.toString(),
    role: "buyer", // Default role for users
  });

  // Set token in cookie
  const response = res as any;
  response.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  response.status(200).json({
    status: "success",
    message: "Login successful",
    data: {
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        referrer: user.referrer,
        position: user.position,
        status: user.status,
      },
      token,
    },
  });
});

/**
 * User Logout
 * POST /api/v1/auth/logout
 */
export const userLogout = asyncHandler(async (req, res) => {
  const response = res as any;
  response.clearCookie("token");

  response.status(200).json({
    status: "success",
    message: "Logout successful",
  });
});

/**
 * Get Current User Profile
 * GET /api/v1/auth/me
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  // req.user will be set by the requireAuth middleware
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        referrer: user.referrer,
        position: user.position,
        status: user.status,
        walletAddress: user.walletAddress,
        bankAccount: user.bankAccount,
        createdAt: (user as any).createdAt,
      },
    },
  });
});

/**
 * Exchange temporary login token for JWT token
 * POST /api/v1/auth/verify-login-token
 */
export const verifyLoginToken = asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError("Token is required", 400);
    }

    // Validate and get token data from Redis
    const tokenData = await validateLoginToken(token);
    
    if (!tokenData) {
      throw new AppError("Invalid or expired login token", 401);
    }

    // Find user by MongoDB ID
    const user = await User.findById(tokenData.userMongoId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Check if user account is active
    if (user.status !== "active") {
      throw new AppError(`User account is ${user.status}`, 403);
    }

    // Generate user JWT token
    const jwtToken = signAuthToken({
      sub: user._id.toString(),
      role: "buyer",
    });

    // Set token in cookie
    const response = res as any;
    response.cookie("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    response.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          referrer: user.referrer,
          position: user.position,
          status: user.status,
        },
        token: jwtToken,
      },
    });
  } catch (error: any) {
    throw new AppError(error.message || "Failed to verify login token", 500);
  }
});

