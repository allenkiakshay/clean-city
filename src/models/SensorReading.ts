import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";

const sensorReadingSchema = new Schema(
  {
    bin: { type: Schema.Types.ObjectId, ref: "Bin", required: true },
    recordedAt: { type: Date, required: true },
    fillPercent: { type: Number, required: true },
    weightKg: { type: Number },
    batteryPercent: { type: Number },
  },
  {
    strict: "throw",
    timeseries: {
      timeField: "recordedAt",
      metaField: "bin",
      granularity: "minutes",
    },
    expireAfterSeconds: 60 * 60 * 24 * 90,
    collection: "sensorreadings",
  },
);

export type SensorReadingDocument = InferSchemaType<typeof sensorReadingSchema> & {
  _id: Types.ObjectId;
};

export const SensorReading = (models.SensorReading ??
  model<SensorReadingDocument>("SensorReading", sensorReadingSchema)) as Model<SensorReadingDocument>;
