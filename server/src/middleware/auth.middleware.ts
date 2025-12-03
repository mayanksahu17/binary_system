import { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../utills/jwt";
import { AppError } from "../utills/AppError";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: "buyer" | "vendor" | "admin" };
      admin?: { id: string; role: number; email: string };
    }
  }
}

/**
 * Middleware to authenticate user using user JWT token
 * Sets req.user with user information
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = 
      req.cookies?.token || 
      (req.headers.authorization?.startsWith("Bearer ") 
        ? req.headers.authorization.split(" ")[1] 
        : null);
    
    if (!token) {
      throw new AppError("User token required", 401);
    }

    const decoded = verifyAuthToken(token);
    req.user = { 
      id: decoded.sub, 
      role: decoded.role 
    };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    return res.status(401).json({ 
      status: "error",
      message: "Invalid or expired token" 
    });
  }
}

/**
 * Middleware to check if user has required role(s)
 * Must be used after requireAuth
 */
export function requireRole(...roles: Array<"buyer" | "vendor" | "admin">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: "error",
        message: "User not authenticated" 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        status: "error",
        message: "Insufficient permissions" 
      });
    }
    
    next();
  };
}
