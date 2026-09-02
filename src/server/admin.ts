import mongoose, { type ClientSession, type Types } from "mongoose";
import { connectMongo } from "@/lib/mongo";
import { slaDeadline } from "@/lib/sla";
import type { Role } from "@/lib/types";
import {
  applyTransition,
  POINTS_ON_VERIFY,
  TRUST_ON_REJECT,
  TRUST_ON_VERIFY,
  TransitionError,
  type TransitionAction,
} from "@/lib/workflow";
import { Notification } from "@/models/Notification";
import { Report, type ReportDocument } from "@/models/Report";
import { User } from "@/models/User";
import { recomputePriority } from "@/server/reports";

/**
 * Every admin action on a report.
 *
 * All of them follow the same shape: check the transition with the pure state
 * machine, then write the status change, the timeline entry and the
 * notification inside ONE transaction. A half-applied action — a status that
 * moved without a timeline entry, or a resolved report whose reporter was never
 * told — is the failure mode this design exists to prevent.
 */

export { TransitionError };

type ActorContext = { actorId: string; role: Role };

type Ref = Types.ObjectId | string;

async function notify(
  session: ClientSession,
  user: Ref,
  report: Ref,
  title: string,
  body: string,
) {
  await Notification.create([{ user, report, title, body }], {
    session,
    ordered: true,
  });
}

/** Trust and points only apply where there is an account behind the report. */
async function adjustReporter(
  session: ClientSession,
  report: ReportDocument,
  trustDelta: number,
  pointsDelta: number,
) {
  if (report.reporterMode === "NONE" || !report.reporter) return;

  await User.updateOne(
    { _id: report.reporter },
    { $inc: { trustScore: trustDelta, points: pointsDelta } },
    { session },
  );
}

async function loadReport(id: string) {
  await connectMongo();
  const report = await Report.findById(id);
  if (!report) throw new TransitionError("Report not found.");
  return report;
}

export async function verifyReport(id: string, actor: ActorContext) {
  const report = await loadReport(id);
  const { to, event } = applyTransition("VERIFY", report.status, actor.role);

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = to;
      report.verifiedAt = now;
      report.slaDueAt = slaDeadline(report.priorityBucket, now);
      report.timeline.push({ type: event, actor: actor.actorId as never, at: now });
      await report.save({ session });

      await adjustReporter(session, report, TRUST_ON_VERIFY, POINTS_ON_VERIFY);

      if (report.reporterMode !== "NONE" && report.reporter) {
        await notify(
          session,
          report.reporter,
          report._id,
          "Report verified",
          "A reviewer confirmed your report. It is now queued for a cleanup crew.",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return report;
}

export async function rejectReport(
  id: string,
  actor: ActorContext,
  note?: string,
) {
  const report = await loadReport(id);
  const { to, event } = applyTransition("REJECT", report.status, actor.role);

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = to;
      report.timeline.push({
        type: event,
        actor: actor.actorId as never,
        note,
        at: now,
      });
      await report.save({ session });

      await adjustReporter(session, report, TRUST_ON_REJECT, 0);

      if (report.reporterMode !== "NONE" && report.reporter) {
        await notify(
          session,
          report.reporter,
          report._id,
          "Report closed",
          note
            ? `A reviewer closed your report: ${note}`
            : "A reviewer decided this did not need a cleanup crew.",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return report;
}

export async function assignReport(
  id: string,
  actor: ActorContext,
  workerId: string,
) {
  const report = await loadReport(id);
  const { to, event } = applyTransition("ASSIGN", report.status, actor.role);

  const worker = await User.findById(workerId).select("_id role name");
  if (!worker || worker.role !== "WORKER") {
    throw new TransitionError("Pick a crew member to assign this to.");
  }

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = to;
      report.assignedTo = worker._id;
      report.timeline.push({
        type: event,
        actor: actor.actorId as never,
        note: worker.name ?? undefined,
        at: now,
      });
      await report.save({ session });

      await notify(
        session,
        worker._id,
        report._id,
        "New task assigned",
        `A ${report.category.toLowerCase().replace("_", " ")} report is waiting for you.`,
      );

      if (report.reporterMode !== "NONE" && report.reporter) {
        await notify(
          session,
          report.reporter,
          report._id,
          "Crew assigned",
          "A cleanup crew has been assigned to your report.",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return report;
}

/**
 * Folds one report into another.
 *
 * A duplicate is not a bad report, so this costs the reporter no trust — it
 * closes theirs and carries their signal across as a confirmation on the
 * surviving report, which raises its priority.
 */
export async function mergeReport(
  id: string,
  actor: ActorContext,
  targetId: string,
) {
  if (id === targetId) {
    throw new TransitionError("A report cannot be merged into itself.");
  }

  const report = await loadReport(id);
  const target = await Report.findById(targetId);

  if (!target) throw new TransitionError("The report to merge into was not found.");
  if (actor.role !== "ADMIN") {
    throw new TransitionError("Only an admin can merge reports.");
  }
  if (report.status === "RESOLVED" || report.status === "REJECTED") {
    throw new TransitionError(`This report is already ${report.status.toLowerCase()}.`);
  }

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = "REJECTED";
      report.duplicateOf = target._id;
      report.timeline.push({
        type: "MERGED",
        actor: actor.actorId as never,
        note: `Folded into report ${String(target._id)}`,
        at: now,
      });
      await report.save({ session });

      // Carry the signal across rather than losing it.
      if (report.reporterMode !== "NONE" && report.reporter) {
        const already = (target.confirmations ?? []).some(
          (entry: { user: unknown }) =>
            String(entry.user) === String(report.reporter),
        );

        if (already === false && String(target.reporter) !== String(report.reporter)) {
          target.confirmations.push({ user: report.reporter, at: now });
          await recomputePriority(target);
        }

        await notify(
          session,
          report.reporter,
          target._id,
          "Report merged",
          "Someone had already reported this. Your report now counts towards theirs.",
        );
      }

      await target.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return { report, target };
}

export const ADMIN_ACTIONS = ["VERIFY", "REJECT", "ASSIGN", "MERGE"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export function isTransitionAction(action: string): action is TransitionAction {
  return ["VERIFY", "REJECT", "ASSIGN", "START", "RESOLVE"].includes(action);
}
