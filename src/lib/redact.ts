import { toLeaflet } from "@/lib/geo";
import type {
  GeoPoint,
  PriorityBucket,
  ReportCategory,
  ReportSource,
  ReportStatus,
  ReporterMode,
  Role,
} from "@/lib/types";

/**
 * The ONLY place a report becomes a public response.
 *
 * Redaction here is structural rather than incidental: `reporterMode` is an
 * explicit stored field, and no route serialises a raw report document. A
 * hidden name therefore cannot leak through a handler that forgot to omit it.
 *
 *   NAMED  → public sees the reporter's name, staff see it too
 *   HIDDEN → public sees "A resident", staff still see the name (abuse handling)
 *   NONE   → public sees "A resident", staff see nothing identifying either
 *
 * `claimToken` and `anonId` are never returned by this function to anyone.
 */

export const ANONYMOUS_LABEL = "A resident";

export type ReporterRef = {
  _id: unknown;
  name?: string | null;
  email?: string | null;
  trustScore?: number | null;
} | null;

export type RedactableReport = {
  _id: unknown;
  source: ReportSource;
  reporterMode: ReporterMode;
  reporter?: ReporterRef;
  anonId?: string | null;
  claimToken?: string | null;
  location: GeoPoint;
  address?: string | null;
  photoUrl?: string | null;
  afterPhotoUrl?: string | null;
  description?: string | null;
  category: ReportCategory;
  status: ReportStatus;
  priorityScore?: number;
  priorityBucket?: PriorityBucket;
  slaDueAt?: Date | null;
  confirmations?: { user: unknown; at: Date }[];
  timeline?: {
    type: string;
    actor?: unknown;
    note?: string | null;
    photoUrl?: string | null;
    at: Date;
  }[];
  createdAt?: Date;
  verifiedAt?: Date | null;
  resolvedAt?: Date | null;
};

export type Viewer = {
  role: Role | null;
  userId: string | null;
};

export const PUBLIC_VIEWER: Viewer = { role: null, userId: null };

export function isStaff(viewer: Viewer): boolean {
  return viewer.role === "ADMIN" || viewer.role === "WORKER";
}

function reporterId(report: RedactableReport): string | null {
  const raw = report.reporter?._id;
  return raw == null ? null : String(raw);
}

/** Name shown to the public. Never the real name for HIDDEN or NONE. */
export function publicReporterLabel(report: RedactableReport): string {
  if (report.source === "SENSOR") return "Bin sensor";
  if (report.reporterMode !== "NAMED") return ANONYMOUS_LABEL;
  return report.reporter?.name?.trim() || ANONYMOUS_LABEL;
}

export type PublicReport = ReturnType<typeof toPublicReport>;

export function toPublicReport(report: RedactableReport, viewer: Viewer) {
  const staff = isStaff(viewer);
  const owner =
    viewer.userId != null && reporterId(report) === viewer.userId;

  const base = {
    id: String(report._id),
    source: report.source,
    category: report.category,
    status: report.status,
    priorityBucket: report.priorityBucket ?? "LOW",
    location: toLeaflet(report.location),
    address: report.address ?? null,
    photoUrl: report.photoUrl ?? null,
    afterPhotoUrl: report.afterPhotoUrl ?? null,
    description: report.description ?? null,
    reporterLabel: publicReporterLabel(report),
    reporterMode: report.reporterMode,
    confirmationCount: report.confirmations?.length ?? 0,
    timeline: (report.timeline ?? []).map((entry) => ({
      type: entry.type,
      note: entry.note ?? null,
      photoUrl: entry.photoUrl ?? null,
      at: entry.at,
    })),
    createdAt: report.createdAt ?? null,
    verifiedAt: report.verifiedAt ?? null,
    resolvedAt: report.resolvedAt ?? null,
    isMine: owner,
  };

  if (!staff) {
    return base;
  }

  // Staff additionally see the operational fields and, for account-backed
  // reports, who filed it. An anonymous report has nobody to reveal.
  return {
    ...base,
    priorityScore: report.priorityScore ?? 0,
    slaDueAt: report.slaDueAt ?? null,
    reporter:
      report.reporterMode === "NONE" || !report.reporter
        ? null
        : {
            id: String(report.reporter._id),
            name: report.reporter.name ?? null,
            email: report.reporter.email ?? null,
            trustScore: report.reporter.trustScore ?? null,
          },
    isAnonymous: report.reporterMode === "NONE",
  };
}

export function toPublicReports(
  reports: RedactableReport[],
  viewer: Viewer,
): PublicReport[] {
  return reports.map((report) => toPublicReport(report, viewer));
}
