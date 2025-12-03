// models/Ticket.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ITicket extends Document {
  raisedBy: Types.ObjectId;
  department: "Admin support" | "Technical Support";
  service: "Package Activation" | "Downline Activation" | "Authentication";
  subject: string;
  description?: string;
  status: "Open" | "Closed" | "In Progress";
  document?: string;
  reply?: string;
}

const TicketSchema = new Schema<ITicket>({
  raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  department: { type: String, enum: ["Admin support","Technical Support"], required: true },
  service: { type: String, enum: ["Package Activation","Downline Activation","Authentication"] },
  subject: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["Open","Closed","In Progress"], default: "Open" },
  document: { type: String },
  reply: { type: String }
}, { timestamps: true });

export const Ticket = model<ITicket>("Ticket", TicketSchema);
