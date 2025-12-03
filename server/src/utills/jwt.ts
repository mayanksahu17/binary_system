import jwt from "jsonwebtoken";
import type { StringValue } from "ms";

// User JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN: StringValue = (process.env.JWT_EXPIRES_IN || "7d") as StringValue;

// Admin JWT configuration (separate secret for admin tokens)
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "admin_secret_change_me";
const ADMIN_JWT_EXPIRES_IN: StringValue = (process.env.ADMIN_JWT_EXPIRES_IN || "7d") as StringValue;

export type JwtPayload = {
  sub: string;            // user id
  role: "buyer" | "vendor" | "admin";
};

export type AdminJwtPayload = {
  sub: string;            // admin id
  role: number;           // AdminRole enum value
  email: string;
};

// User token functions
export function signAuthToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as JwtPayload & { iat: number; exp: number };
}

// Admin token functions (separate from user tokens)
export function signAdminToken(payload: AdminJwtPayload) {
  return jwt.sign(payload, ADMIN_JWT_SECRET as string, { expiresIn: ADMIN_JWT_EXPIRES_IN });
}

export function verifyAdminToken(token: string) {
  return jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload & { iat: number; exp: number };
}
