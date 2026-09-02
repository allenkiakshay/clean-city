import { describe, expect, it } from "vitest";
import { ageEscalation, bucketFor, computePriority } from "@/lib/priority";
import { slaDeadline, slaHours } from "@/lib/sla";

const base = {
  category: "LITTER" as const,
  confirmations: 0,
  sensorBoost: false,
  zoneSensitivity: 0,
  ageHours: 0,
};

describe("computePriority", () => {
  it("reproduces the worked example from the plan", () => {
    // Overflow beside a school, three neighbours confirmed, bin 12 m away at 91%.
    // 30 (overflow) + 18 (3x6) + 25 (sensor) + 12 (school zone) + 0 (fresh) = 85
    const result = computePriority({
      category: "OVERFLOW",
      confirmations: 3,
      sensorBoost: true,
      zoneSensitivity: 12,
      ageHours: 0,
    });

    expect(result.score).toBe(85);
    expect(result.bucket).toBe("CRITICAL");
  });

  it("scores the same overflow on an empty road far lower", () => {
    const result = computePriority({ ...base, category: "OVERFLOW" });
    expect(result.score).toBe(30);
    expect(result.bucket).toBe("MEDIUM");
  });

  it("caps corroboration at five confirmations", () => {
    const five = computePriority({ ...base, confirmations: 5 });
    const fifty = computePriority({ ...base, confirmations: 50 });
    expect(five.score).toBe(fifty.score);
    expect(five.score).toBe(15 + 30);
  });

  it("applies the sensor boost only when set", () => {
    const without = computePriority({ ...base, category: "OVERFLOW" });
    const with_ = computePriority({
      ...base,
      category: "OVERFLOW",
      sensorBoost: true,
    });
    expect(with_.score - without.score).toBe(25);
  });

  it("clamps zone sensitivity to 0-15", () => {
    expect(computePriority({ ...base, zoneSensitivity: 999 }).score).toBe(
      15 + 15,
    );
    expect(computePriority({ ...base, zoneSensitivity: -50 }).score).toBe(15);
  });

  it("never exceeds 100 or drops below 0", () => {
    const max = computePriority({
      category: "DEAD_ANIMAL",
      confirmations: 5,
      sensorBoost: true,
      zoneSensitivity: 15,
      ageHours: 10_000,
    });
    expect(max.score).toBe(100);
    expect(max.bucket).toBe("CRITICAL");
  });

  it("orders the categories as the plan specifies", () => {
    const score = (category: Parameters<typeof computePriority>[0]["category"]) =>
      computePriority({ ...base, category }).score;

    expect(score("DEAD_ANIMAL")).toBeGreaterThan(score("ILLEGAL_DUMP"));
    expect(score("ILLEGAL_DUMP")).toBeGreaterThan(score("OVERFLOW"));
    expect(score("OVERFLOW")).toBeGreaterThan(score("DEBRIS"));
    expect(score("DEBRIS")).toBeGreaterThan(score("LITTER"));
  });
});

describe("ageEscalation", () => {
  it("adds nothing before the first six hours", () => {
    expect(ageEscalation(0)).toBe(0);
    expect(ageEscalation(5.9)).toBe(0);
  });

  it("adds two points per six hours open", () => {
    expect(ageEscalation(6)).toBe(2);
    expect(ageEscalation(12)).toBe(4);
    expect(ageEscalation(24)).toBe(8);
  });

  it("caps at twenty so age alone cannot create a CRITICAL", () => {
    expect(ageEscalation(10_000)).toBe(20);
  });

  it("ignores negative and non-finite input", () => {
    expect(ageEscalation(-5)).toBe(0);
    expect(ageEscalation(Number.NaN)).toBe(0);
  });

  it("means an ignored litter report climbs on its own", () => {
    const fresh = computePriority({ ...base, ageHours: 0 });
    const stale = computePriority({ ...base, ageHours: 72 });
    expect(stale.score).toBeGreaterThan(fresh.score);
  });
});

describe("bucketFor boundaries", () => {
  it.each([
    [0, "LOW"],
    [24, "LOW"],
    [25, "MEDIUM"],
    [49, "MEDIUM"],
    [50, "HIGH"],
    [74, "HIGH"],
    [75, "CRITICAL"],
    [100, "CRITICAL"],
  ] as const)("%i -> %s", (score, bucket) => {
    expect(bucketFor(score)).toBe(bucket);
  });
});

describe("sla", () => {
  it("gives more urgent buckets tighter deadlines", () => {
    expect(slaHours("CRITICAL")).toBe(4);
    expect(slaHours("HIGH")).toBe(12);
    expect(slaHours("MEDIUM")).toBe(24);
    expect(slaHours("LOW")).toBe(72);
  });

  it("computes the deadline from the verification time", () => {
    const from = new Date("2026-09-02T10:00:00.000Z");
    expect(slaDeadline("CRITICAL", from).toISOString()).toBe(
      "2026-09-02T14:00:00.000Z",
    );
  });
});
