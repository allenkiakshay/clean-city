import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";
import {
  PRIORITY_BUCKETS,
  REPORT_CATEGORIES,
  REPORT_SOURCES,
  REPORT_STATUSES,
  REPORTER_MODES,
} from "@/lib/types";

const confirmationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const timelineEntrySchema = new Schema(
  {
    type: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String },
    photoUrl: { type: String },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const reportSchema = new Schema(
  {
    source: { type: String, enum: REPORT_SOURCES, required: true },
    reporterMode: { type: String, enum: REPORTER_MODES, required: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User", default: null },
    claimToken: { type: String },
    bin: { type: Schema.Types.ObjectId, ref: "Bin", default: null },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: { type: String },
    photoUrl: { type: String },
    afterPhotoUrl: { type: String },
    description: { type: String },
    category: { type: String, enum: REPORT_CATEGORIES, required: true },
    status: { type: String, enum: REPORT_STATUSES, default: "SUBMITTED" },
    priorityScore: { type: Number, default: 0 },
    priorityBucket: { type: String, enum: PRIORITY_BUCKETS, default: "LOW" },
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Report" },
    slaDueAt: { type: Date },
    confirmations: { type: [confirmationSchema], default: [] },
    timeline: { type: [timelineEntrySchema], default: [] },
    verifiedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

reportSchema.index({ location: "2dsphere" });
reportSchema.index({ status: 1, priorityScore: -1 });
reportSchema.index({ status: 1, slaDueAt: 1 });
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ claimToken: 1 }, { unique: true, sparse: true });
reportSchema.index({ assignedTo: 1, status: 1 });
reportSchema.index({ "confirmations.user": 1 });

export type ReportDocument = InferSchemaType<typeof reportSchema> & {
  _id: Types.ObjectId;
};

export const Report = (models.Report ??
  model<ReportDocument>("Report", reportSchema)) as Model<ReportDocument>;
