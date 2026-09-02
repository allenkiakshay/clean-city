import mongoose from "mongoose";
import { connectMongo } from "../src/lib/mongo";
import {
  Bin,
  Notification,
  Photo,
  Report,
  User,
  Zone,
} from "../src/models";

async function ensureSensorReadingsCollection() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not ready");
  }

  const collections = await db
    .listCollections({ name: "sensorreadings" })
    .toArray();

  if (collections.length === 0) {
    await db.createCollection("sensorreadings", {
      timeseries: {
        timeField: "recordedAt",
        metaField: "bin",
        granularity: "minutes",
      },
      expireAfterSeconds: 60 * 60 * 24 * 90,
    });
    console.log("Created time-series collection: sensorreadings");
  } else {
    const info = collections[0]!;
    if (info.type !== "timeseries") {
      throw new Error(
        "sensorreadings exists but is not a time-series collection. Drop it and rerun db:indexes.",
      );
    }
    console.log("sensorreadings time-series collection already exists");
  }
}

async function syncModelIndexes() {
  const models = [User, Zone, Bin, Report, Notification, Photo];

  for (const model of models) {
    await model.syncIndexes();
    console.log(`Synced indexes for ${model.modelName}`);
  }
}

async function main() {
  await connectMongo();
  await ensureSensorReadingsCollection();
  await syncModelIndexes();
  console.log("All indexes synced.");
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
