import { describe, expect, it } from "vitest";

/**
 * `next build` imports every route module to collect its config, and those
 * imports reach `lib/mongo`. If this module throws at evaluation time when
 * MONGODB_URI is absent, the BUILD fails — not the request — with an error
 * pointing at this file rather than at the missing variable.
 *
 * That is exactly what broke the first Vercel deploy. These tests pin the rule.
 */
describe("module import is free of runtime config", () => {
  it("imports without MONGODB_URI set", async () => {
    delete process.env.MONGODB_URI;
    await expect(import("@/lib/mongo")).resolves.toBeDefined();
  });

  it("still refuses to connect, with an actionable message", async () => {
    delete process.env.MONGODB_URI;
    const { connectMongo } = await import("@/lib/mongo");
    await expect(connectMongo()).rejects.toThrow(/MONGODB_URI is not set/);
  });
});
