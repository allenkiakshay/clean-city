import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
  Types,
} from "mongoose";

/**
 * Photos live in their own collection, never on the report document.
 *
 * That is the whole design decision here. The admin queue loads a hundred
 * reports at a time; if each carried ~300 KB of image bytes, every
 * `Report.find()` in the app would drag 30 MB behind it. Keeping the bytes
 * separate means reports stay small and existing queries are untouched — the
 * report only ever holds `/api/photos/<id>` in its `photoUrl` string.
 *
 * Plain BSON binary rather than GridFS: photos are downscaled in the browser to
 * a few hundred KB, nowhere near the 16 MB document ceiling, so GridFS's
 * chunking would be pure overhead.
 */
const photoSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  {
    strict: "throw",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export type PhotoDocument = InferSchemaType<typeof photoSchema> & {
  _id: Types.ObjectId;
};

export const Photo = (models.Photo ??
  model<PhotoDocument>("Photo", photoSchema)) as Model<PhotoDocument>;
