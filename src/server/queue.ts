import { connectMongo } from "@/lib/mongo";
import { toPublicReports, type Viewer } from "@/lib/redact";
import type { ReportStatus } from "@/lib/types";
import { Report } from "@/models/Report";
import { User } from "@/models/User";
import { OPEN_STATUSES } from "@/server/reports";

export type QueueFilter = "PENDING" | "OPEN" | "ALL";

const FILTERS: Record<QueueFilter, ReportStatus[] | null> = {
  PENDING: ["SUBMITTED"],
  OPEN: OPEN_STATUSES,
  ALL: null,
};

/**
 * The queue query. Served straight off `{ status: 1, priorityScore: -1 }` —
 * the index exists for exactly this call, so the most urgent unhandled report
 * is always the first document scanned.
 */
export async function loadQueue(filter: QueueFilter, viewer: Viewer, limit = 100) {
  await connectMongo();

  const statuses = FILTERS[filter];

  const reports = await Report.find(statuses ? { status: { $in: statuses } } : {})
    .sort({ priorityScore: -1, createdAt: 1 })
    .limit(limit)
    .populate("reporter", "name email trustScore")
    .populate("assignedTo", "name")
    .lean();

  return toPublicReports(reports as never, viewer);
}

export async function loadWorkers() {
  await connectMongo();
  const workers = await User.find({ role: "WORKER" })
    .select("name email")
    .sort({ name: 1 })
    .lean();

  return workers.map((worker) => ({
    id: String(worker._id),
    name: worker.name ?? worker.email,
  }));
}

export type DashboardStats = Awaited<ReturnType<typeof loadStats>>;

/** Dashboard counters, in one round trip rather than six. */
export async function loadStats() {
  await connectMongo();
  const now = new Date();

  const [byStatus, breached, anonymous, resolvedTimes] = await Promise.all([
    Report.aggregate<{ _id: ReportStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Report.countDocuments({
      status: { $in: OPEN_STATUSES },
      slaDueAt: { $lt: now },
    }),
    Report.countDocuments({ reporterMode: "NONE" }),
    Report.aggregate<{ avgMs: number }>([
      { $match: { status: "RESOLVED", resolvedAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } },
        },
      },
    ]),
  ]);

  const counts = Object.fromEntries(
    byStatus.map((row) => [row._id, row.count]),
  ) as Partial<Record<ReportStatus, number>>;

  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const closed = (counts.RESOLVED ?? 0) + (counts.REJECTED ?? 0);

  return {
    total,
    pending: counts.SUBMITTED ?? 0,
    verified: counts.VERIFIED ?? 0,
    assigned: (counts.ASSIGNED ?? 0) + (counts.IN_PROGRESS ?? 0),
    resolved: counts.RESOLVED ?? 0,
    rejected: counts.REJECTED ?? 0,
    open: total - closed,
    slaBreached: breached,
    anonymous,
    avgResolutionHours: resolvedTimes[0]?.avgMs
      ? Math.round((resolvedTimes[0].avgMs / 3_600_000) * 10) / 10
      : null,
  };
}
