import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";
import { BIN_STATUSES } from "@/lib/types";

const deviceSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    lastSeenAt: { type: Date },
    batteryPercent: { type: Number },
    firmware: { type: String },
  },
  { _id: false },
);

const latestReadingSchema = new Schema(
  {
    fillPercent: { type: Number },
    recordedAt: { type: Date },
  },
  { _id: false },
);

const binSchema = new Schema(
  {
    code: { type: String, required: true },
    label: { type: String, required: true },
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
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true },
    capacityLiters: { type: Number, required: true },
    status: { type: String, enum: BIN_STATUSES, default: "ACTIVE" },
    device: { type: deviceSchema, required: true },
    latestReading: { type: latestReadingSchema },
    installedAt: { type: Date, default: Date.now },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

binSchema.index({ location: "2dsphere" });
binSchema.index({ code: 1 }, { unique: true });
binSchema.index({ "device.tokenHash": 1 });

export type BinDocument = InferSchemaType<typeof binSchema> & {
  _id: Types.ObjectId;
};

export const Bin = (models.Bin ??
  model<BinDocument>("Bin", binSchema)) as Model<BinDocument>;
