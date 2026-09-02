import { describe, expect, it } from "vitest";
import { authErrorMessage, homePathForRole } from "@/lib/auth-helpers";

describe("auth helpers", () => {
  it("maps roles to home paths", () => {
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("WORKER")).toBe("/worker");
    expect(homePathForRole("CITIZEN")).toBe("/");
  });

  it("explains unverified Google linking failures", () => {
    expect(authErrorMessage("EmailNotVerified")).toContain("password");
  });
});
