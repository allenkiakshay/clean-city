import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";

const zoneSchema = new Schema(
  {
    name: { type: String, required: true },
    wardCode: { type: String, required: true },
    area: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },
    centroid: {
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
    sensitivity: { type: Number, required: true, min: 0, max: 15 },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

zoneSchema.index({ area: "2dsphere" });

export type ZoneDocument = InferSchemaType<typeof zoneSchema> & {
  _id: Types.ObjectId;
};

export const Zone = (models.Zone ??
  model<ZoneDocument>("Zone", zoneSchema)) as Model<ZoneDocument>;
