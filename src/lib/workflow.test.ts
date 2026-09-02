import { describe, expect, it } from "vitest";
import {
  applyTransition,
  availableActions,
  canTransition,
  isTerminal,
  TransitionError,
  type TransitionAction,
} from "@/lib/workflow";
import type { ReportStatus, Role } from "@/lib/types";

const ALL_STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];
const ALL_ACTIONS: TransitionAction[] = [
  "VERIFY",
  "REJECT",
  "ASSIGN",
  "START",
  "RESOLVE",
];
const ALL_ROLES: (Role | null)[] = ["CITIZEN", "ADMIN", "WORKER", null];

describe("the happy path", () => {
  it("walks SUBMITTED → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED", () => {
    expect(applyTransition("VERIFY", "SUBMITTED", "ADMIN").to).toBe("VERIFIED");
    expect(applyTransition("ASSIGN", "VERIFIED", "ADMIN").to).toBe("ASSIGNED");
    expect(applyTransition("START", "ASSIGNED", "WORKER").to).toBe("IN_PROGRESS");
    expect(applyTransition("RESOLVE", "IN_PROGRESS", "WORKER").to).toBe(
      "RESOLVED",
    );
  });

  it("writes a timeline event type for every transition", () => {
    expect(applyTransition("VERIFY", "SUBMITTED", "ADMIN").event).toBe("VERIFIED");
    expect(applyTransition("REJECT", "SUBMITTED", "ADMIN").event).toBe("REJECTED");
  });
});

describe("role enforcement", () => {
  it("never lets a citizen change any report state", () => {
    for (const action of ALL_ACTIONS) {
      for (const status of ALL_STATUSES) {
        expect(canTransition(action, status, "CITIZEN")).toBe(false);
      }
    }
  });

  it("never lets a signed-out visitor change any report state", () => {
    for (const action of ALL_ACTIONS) {
      for (const status of ALL_STATUSES) {
        expect(canTransition(action, status, null)).toBe(false);
      }
    }
  });

  it("stops a worker verifying or rejecting", () => {
    expect(canTransition("VERIFY", "SUBMITTED", "WORKER")).toBe(false);
    expect(canTransition("REJECT", "SUBMITTED", "WORKER")).toBe(false);
  });

  it("stops an admin starting work in the field", () => {
    expect(canTransition("START", "ASSIGNED", "ADMIN")).toBe(false);
  });

  it("does let an admin resolve, for when a crew cannot update in the field", () => {
    expect(canTransition("RESOLVE", "IN_PROGRESS", "ADMIN")).toBe(true);
  });
});

describe("illegal transitions throw, they never silently no-op", () => {
  it("refuses to verify an already-verified report", () => {
    expect(() => applyTransition("VERIFY", "VERIFIED", "ADMIN")).toThrow(
      TransitionError,
    );
  });

  it("refuses to skip verification and assign straight from SUBMITTED", () => {
    expect(() => applyTransition("ASSIGN", "SUBMITTED", "ADMIN")).toThrow(
      TransitionError,
    );
  });

  it("refuses to start a report nobody has been assigned to", () => {
    expect(() => applyTransition("START", "VERIFIED", "WORKER")).toThrow(
      TransitionError,
    );
  });

  it("explains why, in words a person can act on", () => {
    expect(() => applyTransition("VERIFY", "RESOLVED", "ADMIN")).toThrow(
      /already resolved/i,
    );
    expect(() => applyTransition("VERIFY", "SUBMITTED", "CITIZEN")).toThrow(
      /cannot verify/i,
    );
  });
});

describe("terminal states are truly terminal", () => {
  it.each(["RESOLVED", "REJECTED"] as const)("%s accepts no action", (status) => {
    expect(isTerminal(status)).toBe(true);
    for (const action of ALL_ACTIONS) {
      for (const role of ALL_ROLES) {
        expect(canTransition(action, status, role)).toBe(false);
      }
    }
  });

  it("leaves every other status non-terminal", () => {
    for (const status of ALL_STATUSES) {
      if (status === "RESOLVED" || status === "REJECTED") continue;
      expect(isTerminal(status)).toBe(false);
    }
  });
});

describe("reassignment", () => {
  it("allows moving an already-assigned report to a different crew", () => {
    expect(applyTransition("ASSIGN", "ASSIGNED", "ADMIN").to).toBe("ASSIGNED");
  });
});

describe("availableActions drives the UI", () => {
  it("offers an admin verify and reject on a new report", () => {
    expect(availableActions("SUBMITTED", "ADMIN").sort()).toEqual([
      "REJECT",
      "VERIFY",
    ]);
  });

  it("offers an admin only assign once verified", () => {
    expect(availableActions("VERIFIED", "ADMIN")).toEqual(["ASSIGN"]);
  });

  it("offers a worker start on an assigned report", () => {
    expect(availableActions("ASSIGNED", "WORKER")).toEqual(["START", "RESOLVE"]);
  });

  it("offers a citizen nothing, ever", () => {
    for (const status of ALL_STATUSES) {
      expect(availableActions(status, "CITIZEN")).toEqual([]);
    }
  });
});
