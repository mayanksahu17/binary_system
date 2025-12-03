import { Request, Response, NextFunction } from "express";
import { verifyAdminToken, verifyAuthToken } from "../utills/jwt";
import { AppError } from "../utills/AppError";
import { User } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; role: number; email: string };
      user?: { id: string; role: "buyer" | "vendor" | "admin" };
    }
  }
}

/**
 * Middleware to authenticate admin using admin JWT token
 * Also allows CROWN-000000 user to access admin routes with user token
 * Sets req.admin with admin information
 */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = 
      req.cookies?.adminToken || 
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ") 
        ? req.headers.authorization.split(" ")[1] 
        : null);
    
    if (!token) {
      throw new AppError("Admin token required", 401);
    }

    // First, try to verify as admin token
    try {
      const decoded = verifyAdminToken(token);
      req.admin = { 
        id: decoded.sub, 
        role: decoded.role,
        email: decoded.email 
      };
      return next();
    } catch (adminError) {
      // Admin token verification failed, try user token
      try {
        const decoded = verifyAuthToken(token);
        
        // Check if this user is CROWN-000000
        const user = await User.findById(decoded.sub);
        if (user && user.userId === "CROWN-000000") {
          // Allow CROWN-000000 user to access admin routes
          // Set req.user for compatibility
          req.user = {
            id: decoded.sub,
            role: decoded.role,
          };
          // Also set req.admin with user info for admin routes
          req.admin = {
            id: decoded.sub,
            role: 1, // Default admin role
            email: user.email || "",
          };
          return next();
        } else {
          throw new AppError("Access denied. Admin privileges required.", 403);
        }
      } catch (userError) {
        // Both verifications failed
        throw new AppError("Invalid or expired token", 401);
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    return res.status(401).json({ 
      status: "error",
      message: "Invalid or expired admin token" 
    });
  }
}

/**
 * Middleware to check if admin has required role(s)
 * Must be used after requireAdminAuth
 */
export function requireAdminRole(...roles: number[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ 
        status: "error",
        message: "Admin not authenticated" 
      });
    }
    
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ 
        status: "error",
        message: "Insufficient permissions" 
      });
    }
    
    next();
  };
}

