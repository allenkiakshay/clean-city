import type { PriorityBucket, ReportCategory } from "@/lib/types";

/**
 * Priority scoring. Pure — no database, no framework. The *inputs* are gathered
 * by MongoDB; the arithmetic lives here so it can be tested in microseconds.
 */

const CATEGORY_WEIGHT: Record<ReportCategory, number> = {
  DEAD_ANIMAL: 40,
  ILLEGAL_DUMP: 35,
  OVERFLOW: 30,
  DEBRIS: 20,
  LITTER: 15,
};

export const MAX_COUNTED_CONFIRMATIONS = 5;
export const CONFIRMATION_WEIGHT = 6;
export const SENSOR_BOOST = 25;
export const MAX_AGE_ESCALATION = 20;

export type PriorityInput = {
  category: ReportCategory;
  /** Signed-in confirmations only. Anonymous users cannot confirm. */
  confirmations: number;
  /** A bin within 30 m read >= 85% full within the last 2 hours. */
  sensorBoost: boolean;
  /** Zone sensitivity, 0-15: school, hospital, market. */
  zoneSensitivity: number;
  /** How long the report has been open, in hours. */
  ageHours: number;
};

export type PriorityResult = {
  score: number;
  bucket: PriorityBucket;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ageEscalation(ageHours: number): number {
  if (!Number.isFinite(ageHours) || ageHours <= 0) return 0;
  return Math.min(Math.floor(ageHours / 6) * 2, MAX_AGE_ESCALATION);
}

export function bucketFor(score: number): PriorityBucket {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function computePriority(input: PriorityInput): PriorityResult {
  const confirmations = clamp(
    Math.floor(input.confirmations),
    0,
    MAX_COUNTED_CONFIRMATIONS,
  );

  const raw =
    CATEGORY_WEIGHT[input.category] +
    confirmations * CONFIRMATION_WEIGHT +
    (input.sensorBoost ? SENSOR_BOOST : 0) +
    clamp(input.zoneSensitivity, 0, 15) +
    ageEscalation(input.ageHours);

  const score = clamp(Math.round(raw), 0, 100);

  return { score, bucket: bucketFor(score) };
}
