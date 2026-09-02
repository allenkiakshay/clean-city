import mongoose from "mongoose";

/**
 * The connection string is RUNTIME config, so it is read when we actually
 * connect — never at module scope.
 *
 * `next build` imports every route module to collect its config. A throw up
 * here therefore fails the build rather than the request, with an error that
 * points at this file instead of at the missing environment variable. Deferring
 * it means a misconfigured deployment fails loudly on the first request, where
 * the message is actionable, and a build never depends on runtime secrets.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cache;

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your environment (Vercel → Settings → " +
        "Environment Variables) and redeploy.",
    );
  }

  if (!cache.promise) {
    cache.promise = connectAndBuildIndexes(uri);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Connects, then WAITS for the indexes to exist before reporting ready.
 *
 * `autoIndex` alone is not enough: Mongoose builds indexes asynchronously, and
 * with `bufferCommands: false` a query issued on a cold start can outrun the
 * build and still fail with NoQueryExecutionPlans. Awaiting `init()` for the
 * models with geospatial indexes makes the guarantee real. It runs once per
 * connection, because the promise is cached.
 */
async function connectAndBuildIndexes(uri: string): Promise<typeof mongoose> {
  const connection = await mongoose.connect(uri, {
    // Left ON in production, against the usual advice.
    //
    // The standard reason to disable it is that an unexpected index build can
    // block a large production collection. That risk does not apply here, and
    // the alternative failure is far worse: without the 2dsphere index every
    // `$near` throws NoQueryExecutionPlans (code 291), which takes down report
    // submission entirely — and that is exactly what happened on the first
    // deploy, because the manual `db:indexes` step is easy to forget.
    //
    // `createIndexes` is a no-op once they exist, so the cost is one command
    // per new connection. `npm run db:indexes` is still the explicit path, and
    // is still REQUIRED for the time-series collection, which Mongoose cannot
    // create.
    autoIndex: true,
    bufferCommands: false,
  });

  // Imported here rather than at module scope so this file stays free of
  // side effects at import time (see the note above about `next build`).
  const { Bin } = await import("@/models/Bin");
  const { Report } = await import("@/models/Report");
  const { Zone } = await import("@/models/Zone");

  // These three carry the 2dsphere indexes every geo query depends on. If the
  // build fails we still return the connection — a slow query beats a dead app,
  // and the route-level handler explains a missing index if one is hit.
  await Promise.all([Report.init(), Bin.init(), Zone.init()]).catch(
    (error: unknown) => {
      console.error("[mongo] index build failed", error);
    },
  );

  return connection;
}
