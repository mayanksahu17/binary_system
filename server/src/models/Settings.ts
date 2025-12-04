// models/Settings.ts
import { Schema, model, Document } from "mongoose";

export interface ISettings extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
  createdAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
SettingsSchema.index({ key: 1 }, { unique: true });

export const Settings = model<ISettings>("Settings", SettingsSchema);

