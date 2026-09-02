import { NextResponse } from "next/server";

/**
 * Turns an unexpected server error into a JSON response that says something.
 *
 * An uncaught throw in a route handler returns a bare 500 with an EMPTY body.
 * The client then has nothing to show, and diagnosing it means digging through
 * platform logs — which is precisely how a missing database index turned into
 * "The server had a problem" with no further clue.
 */

/** MongoDB: `$near` with no 2dsphere index to serve it. */
const NO_QUERY_PLAN = 291;

function mongoCode(error: unknown): number | null {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "number" ? code : null;
}

export function describeServerError(error: unknown): {
  message: string;
  hint: string | null;
} {
  if (mongoCode(error) === NO_QUERY_PLAN) {
    return {
      message:
        "The database is missing its geospatial index, so nearby reports cannot be checked.",
      hint: "Run `npm run db:indexes` against this database.",
    };
  }

  const raw = error instanceof Error ? error.message : "";

  if (/IllegalOperation|Transaction numbers|replica set/i.test(raw)) {
    return {
      message: "The database does not support transactions.",
      hint: "This needs a replica set — Atlas provides one; a standalone mongod does not.",
    };
  }

  if (/ENOTFOUND|ETIMEDOUT|querySrv|ECONNREFUSED|ServerSelection/i.test(raw)) {
    return {
      message: "Could not reach the database.",
      hint: "Check MONGODB_URI and that Atlas network access allows this deployment.",
    };
  }

  return { message: "Something went wrong on the server.", hint: null };
}

/**
 * Logs the real error (server-side, where the stack is useful) and returns a
 * JSON body the client can actually render.
 */
export function serverErrorResponse(error: unknown, route: string) {
  console.error(`[${route}]`, error);

  const { message, hint } = describeServerError(error);

  return NextResponse.json(
    {
      error: message,
      // The hint names a fix rather than leaking internals, and it is what
      // turns a 20-minute log hunt into a 30-second one.
      ...(hint ? { hint } : {}),
    },
    { status: 500 },
  );
}
