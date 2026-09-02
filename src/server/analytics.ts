import { Types } from "mongoose";
import { connectMongo } from "@/lib/mongo";
import type { PriorityBucket, ReportCategory, ReportStatus } from "@/lib/types";
import { Bin } from "@/models/Bin";
import { Report } from "@/models/Report";
import { User } from "@/models/User";
import { Zone } from "@/models/Zone";
import { OPEN_STATUSES } from "@/server/reports";

/**
 * Aggregation pipelines. Verbose next to the equivalent SQL — that is the trade
 * accepted when the data layer moved to MongoDB — so they are all confined to
 * this file rather than spread through pages.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Heat points as [lat, lng, weight], bucketed onto a ~100 m grid. */
export async function heatPoints(days = 90) {
  await connectMongo();
  const since = new Date(Date.now() - days * DAY_MS);
  const SIZE = 0.0009;

  const cells = await Report.aggregate<{
    _id: { row: number; col: number };
    count: number;
  }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          row: {
            $floor: {
              $divide: [{ $arrayElemAt: ["$location.coordinates", 1] }, SIZE],
            },
          },
          col: {
            $floor: {
              $divide: [{ $arrayElemAt: ["$location.coordinates", 0] }, SIZE],
            },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 500 },
  ]);

  const max = cells[0]?.count ?? 1;

  return cells.map((cell) => ({
    lat: (cell._id.row + 0.5) * SIZE,
    lng: (cell._id.col + 0.5) * SIZE,
    weight: cell.count / max,
    count: cell.count,
  }));
}

/** Reports per day, split into created and resolved. */
export async function reportTrend(days = 30) {
  await connectMongo();
  const since = new Date(Date.now() - days * DAY_MS);

  const [created, resolved] = await Promise.all([
    Report.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate<{ _id: string; count: number }>([
      { $match: { resolvedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$resolvedAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const createdBy = new Map(created.map((row) => [row._id, row.count]));
  const resolvedBy = new Map(resolved.map((row) => [row._id, row.count]));

  const out: { day: string; created: number; resolved: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    out.push({
      day,
      created: createdBy.get(day) ?? 0,
      resolved: resolvedBy.get(day) ?? 0,
    });
  }

  return out;
}

export async function categoryBreakdown() {
  await connectMongo();

  const rows = await Report.aggregate<{ _id: ReportCategory; count: number }>([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    category: row._id,
    label: row._id.replace("_", " ").toLowerCase(),
    count: row.count,
  }));
}

export async function bucketBreakdown() {
  await connectMongo();

  const rows = await Report.aggregate<{ _id: PriorityBucket; count: number }>([
    { $match: { status: { $in: OPEN_STATUSES } } },
    { $group: { _id: "$priorityBucket", count: { $sum: 1 } } },
  ]);

  const order: PriorityBucket[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const byBucket = new Map(rows.map((row) => [row._id, row.count]));

  return order.map((bucket) => ({ bucket, count: byBucket.get(bucket) ?? 0 }));
}

/**
 * SLA compliance: of the reports that reached RESOLVED and had a deadline, how
 * many made it. Open-but-overdue is counted separately because it is the number
 * that should make somebody move.
 */
export async function slaCompliance() {
  await connectMongo();
  const now = new Date();

  const [rows, openBreached] = await Promise.all([
    Report.aggregate<{ _id: boolean; count: number }>([
      { $match: { status: "RESOLVED", slaDueAt: { $ne: null }, resolvedAt: { $ne: null } } },
      {
        $group: {
          _id: { $lte: ["$resolvedAt", "$slaDueAt"] },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.countDocuments({
      status: { $in: OPEN_STATUSES },
      slaDueAt: { $lt: now },
    }),
  ]);

  const onTime = rows.find((row) => row._id === true)?.count ?? 0;
  const late = rows.find((row) => row._id === false)?.count ?? 0;
  const total = onTime + late;

  return {
    onTime,
    late,
    openBreached,
    percentOnTime: total === 0 ? null : Math.round((onTime / total) * 100),
  };
}

/** Average hours from report to resolution, per ward. */
export async function resolutionByZone() {
  await connectMongo();

  const [rows, zones] = await Promise.all([
    Report.aggregate<{ _id: unknown; avgMs: number; count: number }>([
      { $match: { status: "RESOLVED", resolvedAt: { $ne: null }, zone: { $ne: null } } },
      {
        $group: {
          _id: "$zone",
          avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } },
          count: { $sum: 1 },
        },
      },
    ]),
    Zone.find().select("name").lean(),
  ]);

  const zoneName = new Map(zones.map((zone) => [String(zone._id), zone.name]));

  return rows
    .map((row) => ({
      zone: zoneName.get(String(row._id)) ?? "Unknown",
      hours: Math.round((row.avgMs / 3_600_000) * 10) / 10,
      count: row.count,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Monthly leaderboard, recomputed from reports rather than read off the running
 * `points` total — a month has to be able to start again from zero.
 *
 * Scoring mirrors the award rules: 10 for a report that got verified, 5 more
 * once it is resolved. Fully anonymous reports have no account to credit.
 */
export async function leaderboard(limit = 10) {
  await connectMongo();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await Report.aggregate<{
    _id: Types.ObjectId;
    reports: number;
    verified: number;
    resolved: number;
  }>([
    {
      $match: {
        reporterMode: { $ne: "NONE" },
        reporter: { $ne: null },
        createdAt: { $gte: monthStart },
      },
    },
    {
      $group: {
        _id: "$reporter",
        reports: { $sum: 1 },
        verified: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"],
                ],
              },
              1,
              0,
            ],
          },
        },
        resolved: {
          $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] },
        },
      },
    },
    { $limit: 200 },
  ]);

  const users = await User.find({ _id: { $in: rows.map((row) => row._id) } })
    .select("name hideNameByDefault trustScore")
    .lean();

  const byId = new Map(users.map((user) => [String(user._id), user]));

  return rows
    .map((row) => {
      const user = byId.get(String(row._id));
      return {
        id: String(row._id),
        // Someone who reports with their name hidden should not be outed by a
        // public leaderboard.
        name: user?.hideNameByDefault
          ? "Anonymous resident"
          : (user?.name ?? "A resident"),
        reports: row.reports,
        points: row.verified * 10 + row.resolved * 5,
      };
    })
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || b.reports - a.reports)
    .slice(0, limit);
}

/**
 * Where the next bin should go.
 *
 * Grid cells with repeated litter reports and no bin within 100 m. The
 * proximity check runs as one `$near` query per candidate cell rather than a
 * `$geoNear` sub-pipeline inside `$lookup`: there are only ever a handful of
 * candidates, and this version is readable.
 */
export async function binPlacementSuggestions(minReports = 3, radiusM = 100) {
  await connectMongo();
  const SIZE = 0.0009;

  const cells = await Report.aggregate<{
    _id: { row: number; col: number };
    count: number;
  }>([
    { $match: { category: { $in: ["LITTER", "ILLEGAL_DUMP", "DEBRIS"] } } },
    {
      $group: {
        _id: {
          row: {
            $floor: {
              $divide: [{ $arrayElemAt: ["$location.coordinates", 1] }, SIZE],
            },
          },
          col: {
            $floor: {
              $divide: [{ $arrayElemAt: ["$location.coordinates", 0] }, SIZE],
            },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: minReports } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const suggestions = [];

  for (const cell of cells) {
    const lat = (cell._id.row + 0.5) * SIZE;
    const lng = (cell._id.col + 0.5) * SIZE;

    const nearby = await Bin.findOne({
      status: "ACTIVE",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
    }).select("_id");

    if (!nearby) {
      suggestions.push({ lat, lng, count: cell.count });
    }
  }

  return suggestions;
}

/** Everything the public map needs, in one call. */
export async function loadMapData() {
  await connectMongo();

  const [reports, bins] = await Promise.all([
    Report.find({ status: { $in: OPEN_STATUSES } })
      .select("location category status priorityBucket createdAt")
      .limit(500)
      .lean(),
    Bin.find({ status: "ACTIVE" })
      .select("code label location latestReading")
      .lean(),
  ]);

  // `.lean()` types the GeoJSON as optional, and a document with no location
  // cannot be drawn anyway — drop it rather than plotting it at null island.
  return {
    reports: reports.flatMap((report) => {
      const coords = report.location?.coordinates;
      if (!coords || coords.length < 2) return [];
      return [
        {
          id: String(report._id),
          lat: coords[1] as number,
          lng: coords[0] as number,
          category: report.category as ReportCategory,
          status: report.status as ReportStatus,
          bucket: report.priorityBucket as PriorityBucket,
        },
      ];
    }),
    bins: bins.flatMap((bin) => {
      const coords = bin.location?.coordinates;
      if (!coords || coords.length < 2) return [];
      return [
        {
          id: String(bin._id),
          code: bin.code,
          label: bin.label,
          lat: coords[1] as number,
          lng: coords[0] as number,
          fillPercent: bin.latestReading?.fillPercent ?? null,
        },
      ];
    }),
  };
}
