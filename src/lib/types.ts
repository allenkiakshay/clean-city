export const ROLES = ["CITIZEN", "ADMIN", "WORKER"] as const;
export type Role = (typeof ROLES)[number];

export const REPORT_SOURCES = ["CITIZEN", "SENSOR"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export const REPORTER_MODES = ["NAMED", "HIDDEN", "NONE"] as const;
export type ReporterMode = (typeof REPORTER_MODES)[number];

export const REPORT_CATEGORIES = [
  "OVERFLOW",
  "LITTER",
  "ILLEGAL_DUMP",
  "DEAD_ANIMAL",
  "DEBRIS",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PRIORITY_BUCKETS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type PriorityBucket = (typeof PRIORITY_BUCKETS)[number];

export const BIN_STATUSES = ["ACTIVE", "MAINTENANCE", "REMOVED"] as const;
export type BinStatus = (typeof BIN_STATUSES)[number];

export type GeoPoint = {
  type: "Point";
  coordinates: [number, number];
};

export type GeoPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};
