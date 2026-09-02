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
    cache.promise = mongoose.connect(uri, {
      autoIndex: process.env.NODE_ENV !== "production",
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
