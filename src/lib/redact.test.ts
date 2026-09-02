import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_LABEL,
  PUBLIC_VIEWER,
  type RedactableReport,
  type Viewer,
  toPublicReport,
} from "@/lib/redact";
import type { ReporterMode } from "@/lib/types";

const REPORTER_ID = "6510000000000000000000aa";

function makeReport(
  reporterMode: ReporterMode,
  overrides: Partial<RedactableReport> = {},
): RedactableReport {
  return {
    _id: "6510000000000000000000ff",
    source: "CITIZEN",
    reporterMode,
    reporter:
      reporterMode === "NONE"
        ? null
        : {
            _id: REPORTER_ID,
            name: "Asha Menon",
            email: "asha@example.com",
            trustScore: 62,
          },
    anonId: reporterMode === "NONE" ? "anon_secret_device_id" : null,
    claimToken: reporterMode === "NONE" ? "claim_secret_token" : null,
    location: { type: "Point", coordinates: [77.6033, 12.9755] },
    category: "OVERFLOW",
    status: "SUBMITTED",
    priorityScore: 55,
    priorityBucket: "HIGH",
    confirmations: [{ user: "u1", at: new Date() }],
    timeline: [
      { type: "SUBMITTED", actor: REPORTER_ID, note: "n", at: new Date() },
    ],
    ...overrides,
  };
}

/**
 * The public and staff shapes are a genuine union — reading `priorityScore`
 * off a public report is a compile error, which is the whole point. This
 * narrows to the staff shape and fails loudly if redaction handed back the
 * public one by mistake.
 */
function staffView(report: RedactableReport, viewer: Viewer) {
  const out = toPublicReport(report, viewer);
  if (!("reporter" in out)) {
    throw new Error("expected a staff view, got the public shape");
  }
  return out;
}

const ADMIN: Viewer = { role: "ADMIN", userId: "admin1" };
const WORKER: Viewer = { role: "WORKER", userId: "worker1" };
const OTHER_CITIZEN: Viewer = { role: "CITIZEN", userId: "someone-else" };
const OWNER: Viewer = { role: "CITIZEN", userId: REPORTER_ID };

describe("secrets never escape, for any mode or viewer", () => {
  const modes: ReporterMode[] = ["NAMED", "HIDDEN", "NONE"];
  const viewers = [PUBLIC_VIEWER, OTHER_CITIZEN, OWNER, WORKER, ADMIN];

  for (const mode of modes) {
    for (const viewer of viewers) {
      it(`${mode} / ${viewer.role ?? "public"}: no claimToken or anonId`, () => {
        const out = JSON.stringify(toPublicReport(makeReport(mode), viewer));
        expect(out).not.toContain("claim_secret_token");
        expect(out).not.toContain("anon_secret_device_id");
        expect(out).not.toContain("claimToken");
        expect(out).not.toContain("anonId");
      });
    }
  }
});

describe("NAMED", () => {
  it("shows the reporter's name publicly", () => {
    expect(toPublicReport(makeReport("NAMED"), PUBLIC_VIEWER).reporterLabel).toBe(
      "Asha Menon",
    );
  });
});

describe("HIDDEN", () => {
  it('shows "A resident" to the public', () => {
    const out = toPublicReport(makeReport("HIDDEN"), PUBLIC_VIEWER);
    expect(out.reporterLabel).toBe(ANONYMOUS_LABEL);
    expect(JSON.stringify(out)).not.toContain("Asha Menon");
  });

  it("hides the name from other citizens too", () => {
    const out = toPublicReport(makeReport("HIDDEN"), OTHER_CITIZEN);
    expect(JSON.stringify(out)).not.toContain("Asha Menon");
  });

  it("still reveals the name to staff, for abuse handling", () => {
    const out = staffView(makeReport("HIDDEN"), ADMIN);
    expect(out.reporter?.name).toBe("Asha Menon");
  });
});

describe("NONE (fully anonymous)", () => {
  it('shows "A resident" to the public', () => {
    expect(toPublicReport(makeReport("NONE"), PUBLIC_VIEWER).reporterLabel).toBe(
      ANONYMOUS_LABEL,
    );
  });

  it("reveals nothing identifying even to an admin", () => {
    const out = staffView(makeReport("NONE"), ADMIN);
    expect(out.reporter).toBeNull();
    expect(out.isAnonymous).toBe(true);
  });
});

describe("operational fields are staff-only", () => {
  it("withholds priorityScore and slaDueAt from the public", () => {
    const out = toPublicReport(makeReport("NAMED"), PUBLIC_VIEWER);
    expect("priorityScore" in out).toBe(false);
    expect("slaDueAt" in out).toBe(false);
  });

  it("gives them to admins and workers", () => {
    expect(staffView(makeReport("NAMED"), ADMIN).priorityScore).toBe(55);
    expect(staffView(makeReport("NAMED"), WORKER).priorityScore).toBe(55);
  });

  it("still exposes the coarse bucket publicly", () => {
    expect(toPublicReport(makeReport("NAMED"), PUBLIC_VIEWER).priorityBucket).toBe(
      "HIGH",
    );
  });
});

describe("timeline", () => {
  it("strips the actor from public timeline entries", () => {
    const out = toPublicReport(makeReport("HIDDEN"), PUBLIC_VIEWER);
    expect(out.timeline[0]).toBeDefined();
    expect("actor" in out.timeline[0]!).toBe(false);
  });
});

describe("ownership", () => {
  it("marks a report as mine for its reporter", () => {
    expect(toPublicReport(makeReport("HIDDEN"), OWNER).isMine).toBe(true);
  });

  it("does not mark it for anyone else", () => {
    expect(toPublicReport(makeReport("HIDDEN"), OTHER_CITIZEN).isMine).toBe(
      false,
    );
    expect(toPublicReport(makeReport("HIDDEN"), PUBLIC_VIEWER).isMine).toBe(
      false,
    );
  });

  it("never marks an anonymous report as mine", () => {
    expect(toPublicReport(makeReport("NONE"), OWNER).isMine).toBe(false);
  });
});

describe("coordinates", () => {
  it("converts stored [lng, lat] back to lat/lng for the client", () => {
    const out = toPublicReport(makeReport("NAMED"), PUBLIC_VIEWER);
    expect(out.location).toEqual({ lat: 12.9755, lng: 77.6033 });
  });
});

describe("sensor reports", () => {
  it("labels them as the bin sensor, not a resident", () => {
    const report = makeReport("NONE", { source: "SENSOR" });
    expect(toPublicReport(report, PUBLIC_VIEWER).reporterLabel).toBe(
      "Bin sensor",
    );
  });
});
