import mongoose, { Schema, model, Document } from "mongoose";

export interface IPayment extends Document {
  user: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  orderId: string;
  paymentId: string; // NOWPayments payment ID
  amount: mongoose.Types.Decimal128;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired" | "cancelled";
  paymentUrl?: string;
  payAddress?: string;
  payAmount?: mongoose.Types.Decimal128;
  payCurrency?: string;
  actuallyPaid?: mongoose.Types.Decimal128;
  investmentId?: mongoose.Types.ObjectId; // Reference to investment once completed
  callbackData?: any; // Store callback data for debugging
  meta?: any; // Additional metadata (e.g., voucher info)
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    package: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "expired", "cancelled"],
      default: "pending",
    },
    paymentUrl: {
      type: String,
    },
    payAddress: {
      type: String,
    },
    payAmount: {
      type: Schema.Types.Decimal128,
    },
    payCurrency: {
      type: String,
    },
    actuallyPaid: {
      type: Schema.Types.Decimal128,
    },
    investmentId: {
      type: Schema.Types.ObjectId,
      ref: "Investment",
    },
    callbackData: {
      type: Schema.Types.Mixed,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const Payment = model<IPayment>("Payment", PaymentSchema);

