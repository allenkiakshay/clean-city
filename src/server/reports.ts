import mongoose, { type HydratedDocument } from "mongoose";
import { nanoid } from "nanoid";
import { connectMongo } from "@/lib/mongo";
import { computePriority } from "@/lib/priority";
import { slaDeadline } from "@/lib/sla";
import type {
  GeoPoint,
  ReportCategory,
  ReportStatus,
  ReporterMode,
} from "@/lib/types";
import type { CreateReportPayload } from "@/lib/validators/report";
import { Bin } from "@/models/Bin";
import { Notification } from "@/models/Notification";
import { Report, type ReportDocument } from "@/models/Report";
import { User } from "@/models/User";
import { Zone } from "@/models/Zone";

/** Statuses that still count as "someone might deal with this". */
export const OPEN_STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
];

export const DEDUPE_RADIUS_M = 50;
export const SENSOR_RADIUS_M = 30;
export const SENSOR_FILL_THRESHOLD = 85;
export const SENSOR_WINDOW_MS = 2 * 60 * 60 * 1000;
export const TRUST_FAST_PATH = 80;

/** Unguessable tracking token handed to an anonymous reporter on submit. */
export function createClaimToken(): string {
  return nanoid(32);
}

export type CreateReportContext = {
  payload: CreateReportPayload;
  /** Null for a signed-out visitor. */
  userId: string | null;
};

export type CreateReportOutcome =
  | {
      kind: "created";
      reportId: string;
      claimToken: string | null;
      status: ReportStatus;
      priorityScore: number;
    }
  | { kind: "confirmed"; reportId: string; confirmationCount: number }
  | { kind: "duplicate"; reportId: string };

/**
 * A signed-out visitor is forced to NONE no matter what they asked for. A
 * signed-in user may still choose NONE — and if they do we genuinely do not
 * record who they are, which is what the word is supposed to mean.
 */
export function resolveReporterMode(
  requested: ReporterMode,
  userId: string | null,
): ReporterMode {
  if (!userId) return "NONE";
  return requested;
}

/**
 * Geospatial reads must happen OUTSIDE a transaction — MongoDB forbids `$near`
 * inside one. All lookups are gathered first; only the writes go in.
 */
async function findOpenDuplicate(location: GeoPoint, category: ReportCategory) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return Report.findOne({
    category,
    status: { $in: OPEN_STATUSES },
    createdAt: { $gte: dayAgo },
    location: {
      $near: { $geometry: location, $maxDistance: DEDUPE_RADIUS_M },
    },
  });
}

async function findZone(location: GeoPoint) {
  return Zone.findOne({
    area: { $geoIntersects: { $geometry: location } },
  }).select("_id sensitivity");
}

/** A nearly-full bin within 30 m, seen in the last two hours. */
async function findSensorBoost(location: GeoPoint) {
  const since = new Date(Date.now() - SENSOR_WINDOW_MS);

  return Bin.findOne({
    location: {
      $near: { $geometry: location, $maxDistance: SENSOR_RADIUS_M },
    },
    "latestReading.fillPercent": { $gte: SENSOR_FILL_THRESHOLD },
    "latestReading.recordedAt": { $gte: since },
  }).select("_id");
}

export async function createReport(
  context: CreateReportContext,
): Promise<CreateReportOutcome> {
  const { payload, userId } = context;
  await connectMongo();

  const mode = resolveReporterMode(payload.requestedMode, userId);
  const location = payload.location;

  // ---- reads (outside any transaction) ------------------------------------

  const duplicate = await findOpenDuplicate(location, payload.category);

  if (duplicate) {
    // An anonymous duplicate is absorbed silently. Letting it add a
    // confirmation would hand anyone a free priority lever, which is why
    // confirmation requires an account.
    if (!userId) {
      return { kind: "duplicate", reportId: String(duplicate._id) };
    }

    const already = (duplicate.confirmations ?? []).some(
      (entry: { user: unknown }) => String(entry.user) === userId,
    );

    if (!already) {
      duplicate.confirmations.push({ user: userId, at: new Date() });
      await recomputePriority(duplicate);
      await duplicate.save();
    }

    return {
      kind: "confirmed",
      reportId: String(duplicate._id),
      confirmationCount: duplicate.confirmations.length,
    };
  }

  const [zone, sensorBin, reporter] = await Promise.all([
    findZone(location),
    findSensorBoost(location),
    userId ? User.findById(userId).select("_id trustScore") : null,
  ]);

  const { score, bucket } = computePriority({
    category: payload.category,
    confirmations: 0,
    sensorBoost: Boolean(sensorBin),
    zoneSensitivity: zone?.sensitivity ?? 0,
    ageHours: 0,
  });

  // Anonymous reports are NEVER fast-pathed — there is no trust score that can
  // skip the queue for them.
  const trusted =
    mode !== "NONE" && (reporter?.trustScore ?? 0) >= TRUST_FAST_PATH;

  const now = new Date();
  const status: ReportStatus = trusted ? "VERIFIED" : "SUBMITTED";
  const claimToken = mode === "NONE" ? createClaimToken() : null;

  // ---- writes (one transaction) -------------------------------------------

  const session = await mongoose.startSession();
  let reportId = "";

  try {
    await session.withTransaction(async () => {
      const [created] = await Report.create(
        [
          {
            source: "CITIZEN",
            reporterMode: mode,
            reporter: mode === "NONE" ? null : userId,
            claimToken: claimToken ?? undefined,
            bin: sensorBin?._id ?? null,
            location,
            address: payload.address,
            photoUrl: payload.photoUrl,
            description: payload.description,
            category: payload.category,
            status,
            priorityScore: score,
            priorityBucket: bucket,
            zone: zone?._id,
            slaDueAt: trusted ? slaDeadline(bucket, now) : undefined,
            verifiedAt: trusted ? now : undefined,
            timeline: [
              {
                type: "SUBMITTED",
                actor: mode === "NONE" ? undefined : userId,
                at: now,
              },
              ...(trusted
                ? [
                    {
                      type: "AUTO_VERIFIED",
                      note: "Reporter trust score",
                      at: now,
                    },
                  ]
                : []),
            ],
          },
        ],
        { session, ordered: true },
      );

      reportId = String(created!._id);

      if (mode !== "NONE" && userId) {
        await Notification.create(
          [
            {
              user: userId,
              report: created!._id,
              title: "Report received",
              body: trusted
                ? "Your report was verified automatically and is queued for a crew."
                : "Your report is with the municipal team for verification.",
            },
          ],
          { session, ordered: true },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return { kind: "created", reportId, claimToken, status, priorityScore: score };
}

/** Recomputes score and bucket in place from the report's current signals. */
export async function recomputePriority(
  report: HydratedDocument<ReportDocument>,
): Promise<void> {
  const zone = report.zone
    ? await Zone.findById(report.zone).select("sensitivity")
    : null;

  const ageHours = report.createdAt
    ? (Date.now() - report.createdAt.getTime()) / (60 * 60 * 1000)
    : 0;

  const { score, bucket } = computePriority({
    category: report.category,
    confirmations: report.confirmations?.length ?? 0,
    sensorBoost: Boolean(report.bin),
    zoneSensitivity: zone?.sensitivity ?? 0,
    ageHours,
  });

  report.priorityScore = score;
  report.priorityBucket = bucket;
}
