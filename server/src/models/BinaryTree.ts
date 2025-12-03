// models/BinaryTree.ts
import { Schema, model, Document, Types } from "mongoose";
import { Position } from "./types";

export interface IBinaryTree extends Document {
  user: Types.ObjectId;
  parent?: Types.ObjectId | null;
  leftChild?: Types.ObjectId | null;
  rightChild?: Types.ObjectId | null;
  leftBusiness: Types.Decimal128; // Cumulative business volume (never decreases)
  rightBusiness: Types.Decimal128; // Cumulative business volume (never decreases)
  leftCarry: Types.Decimal128; // Unmatched portion (recalculated on binary calculation)
  rightCarry: Types.Decimal128; // Unmatched portion (recalculated on binary calculation)
  leftMatched: Types.Decimal128; // Amount matched from leftBusiness (for tracking)
  rightMatched: Types.Decimal128; // Amount matched from rightBusiness (for tracking)
  leftDownlines: number;
  rightDownlines: number;
  matchingDue: Types.Decimal128;
  cappingLimit?: Types.Decimal128;
}

const BinaryTreeSchema = new Schema<IBinaryTree>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  parent: { type: Schema.Types.ObjectId, ref: "User" },
  leftChild: { type: Schema.Types.ObjectId, ref: "User" },
  rightChild: { type: Schema.Types.ObjectId, ref: "User" },
  leftBusiness: { type: Schema.Types.Decimal128, default: "0" }, // Cumulative business volume (never decreases)
  rightBusiness: { type: Schema.Types.Decimal128, default: "0" }, // Cumulative business volume (never decreases)
  leftCarry: { type: Schema.Types.Decimal128, default: "0" }, // Unmatched portion (recalculated on binary calculation)
  rightCarry: { type: Schema.Types.Decimal128, default: "0" }, // Unmatched portion (recalculated on binary calculation)
  leftMatched: { type: Schema.Types.Decimal128, default: "0" }, // Amount matched from leftBusiness (for tracking)
  rightMatched: { type: Schema.Types.Decimal128, default: "0" }, // Amount matched from rightBusiness (for tracking)
  leftDownlines: { type: Number, default: 0 },
  rightDownlines: { type: Number, default: 0 },
  matchingDue: { type: Schema.Types.Decimal128, default: "0" },
  cappingLimit: { type: Schema.Types.Decimal128, default: "0" }
}, { timestamps: true });

BinaryTreeSchema.index({ parent: 1 });

export const BinaryTree = model<IBinaryTree>("BinaryTree", BinaryTreeSchema);
