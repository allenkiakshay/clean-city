import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    report: { type: Schema.Types.ObjectId, ref: "Report", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    readAt: { type: Date },
  },
  {
    strict: "throw",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
};

export const Notification = (models.Notification ??
  model<NotificationDocument>("Notification", notificationSchema)) as Model<NotificationDocument>;
