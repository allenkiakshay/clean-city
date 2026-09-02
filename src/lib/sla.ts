import type { PriorityBucket } from "@/lib/types";

export const SLA_HOURS: Record<PriorityBucket, number> = {
  CRITICAL: 4,
  HIGH: 12,
  MEDIUM: 24,
  LOW: 72,
};

export function slaHours(bucket: PriorityBucket): number {
  return SLA_HOURS[bucket];
}

export function slaDeadline(bucket: PriorityBucket, from: Date): Date {
  return new Date(from.getTime() + slaHours(bucket) * 60 * 60 * 1000);
}

export function isSlaBreached(slaDueAt: Date | null, now: Date): boolean {
  if (!slaDueAt) return false;
  return slaDueAt.getTime() < now.getTime();
}
