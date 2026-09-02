import { Schema, model, models, type InferSchemaType,
  type Model,
  Types,
} from "mongoose";
import { ROLES } from "@/lib/types";

const linkedAccountSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    linkedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Date },
    passwordHash: { type: String, default: null },
    name: { type: String },
    phone: { type: String },
    image: { type: String },
    accounts: { type: [linkedAccountSchema], default: [] },
    role: { type: String, enum: ROLES, default: "CITIZEN" },
    points: { type: Number, default: 0 },
    trustScore: { type: Number, default: 50 },
    hideNameByDefault: { type: Boolean, default: false },
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index(
  { "accounts.provider": 1, "accounts.providerAccountId": 1 },
  { unique: true, sparse: true },
);
userSchema.index({ role: 1, points: -1 });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};

export const User = (models.User ??
  model<UserDocument>("User", userSchema)) as Model<UserDocument>;
