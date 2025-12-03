// models/Admin.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";

export enum AdminRole {
  SUPERADMIN = 1,
  ADMIN = 2,
  SUPPORT = 3,
  MANAGER = 4,
  // extend as needed
}

export interface IAdmin extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  securityPin?: number | null;
  isVerified: boolean;
  role: AdminRole;
  comparePassword(candidate: string): Promise<boolean>;
}

const AdminSchema = new Schema<IAdmin>({
  name: { type: String, required: true, maxlength: 50, trim: true },
  email: { type: String, required: true, maxlength: 80, lowercase: true, trim: true, index: true, unique: true },
  phone: { type: String, maxlength: 20, trim: true, index: true, sparse: true },
  password: { type: String, required: true }, // store hashed
  securityPin: { type: Number, required: false, default: null },
  isVerified: { type: Boolean, default: false },
  role: { type: Number, enum: Object.values(AdminRole), default: AdminRole.ADMIN },
}, { timestamps: true });

// Indexes
AdminSchema.index({ email: 1 }, { unique: true, sparse: true });
AdminSchema.index({ phone: 1 }, { sparse: true });

// Password hashing
const SALT_ROUNDS = 12;

AdminSchema.pre<IAdmin>("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(this.password, salt);
    this.password = hash;
    next();
  } catch (err) {
    next(err as any);
  }
});

// Instance method to compare password
AdminSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Optional: hide sensitive fields when converting to JSON
AdminSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

export const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>("Admin", AdminSchema);
export default Admin;
