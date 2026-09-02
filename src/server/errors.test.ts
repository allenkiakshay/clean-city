import { describe, expect, it } from "vitest";
import { describeServerError } from "@/server/errors";

/**
 * The first production deploy returned a bare 500 with an empty body because a
 * `$near` query had no 2dsphere index (MongoDB code 291). These map the causes
 * that actually happen onto messages that name the fix.
 */
describe("describeServerError", () => {
  it("recognises a missing geospatial index and names the fix", () => {
    const out = describeServerError(
      Object.assign(new Error("error processing query ... GEONEAR"), { code: 291 }),
    );
    expect(out.message).toMatch(/geospatial index/i);
    expect(out.hint).toMatch(/db:indexes/);
  });

  it("recognises a database it cannot reach", () => {
    const out = describeServerError(new Error("querySrv ENOTFOUND _mongodb._tcp.x"));
    expect(out.message).toMatch(/could not reach/i);
    expect(out.hint).toMatch(/MONGODB_URI|network access/i);
  });

  it("recognises a non-replica-set, which cannot do transactions", () => {
    const out = describeServerError(
      new Error("Transaction numbers are only allowed on a replica set member"),
    );
    expect(out.message).toMatch(/transactions/i);
  });

  it("falls back without leaking internals", () => {
    const out = describeServerError(new Error("ECONNRESET at line 42 of /var/task/x.js"));
    expect(out.message).toBe("Something went wrong on the server.");
    expect(out.message).not.toMatch(/var\/task|line 42/);
    expect(out.hint).toBeNull();
  });

  it("handles a non-Error throw", () => {
    expect(describeServerError("boom").message).toBeTruthy();
    expect(describeServerError(null).message).toBeTruthy();
  });
});
