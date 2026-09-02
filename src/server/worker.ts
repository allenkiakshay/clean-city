import mongoose, { type ClientSession, type Types } from "mongoose";
import { connectMongo } from "@/lib/mongo";
import { toPublicReports, type Viewer } from "@/lib/redact";
import type { Role } from "@/lib/types";
import { applyTransition, POINTS_ON_RESOLVE, TransitionError } from "@/lib/workflow";
import { Notification } from "@/models/Notification";
import { Report } from "@/models/Report";
import { User } from "@/models/User";

/**
 * The crew side.
 *
 * Two transitions, both transactional. RESOLVE is the one that matters: it is
 * where the promise made on the report form — that someone will tell you what
 * happened — is actually kept.
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

/** Tasks belonging to one crew member, worst first. */
export async function loadTasks(workerId: string, viewer: Viewer) {
  await connectMongo();

  const reports = await Report.find({
    assignedTo: workerId,
    status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
  })
    .sort({ priorityScore: -1, slaDueAt: 1 })
    .populate("reporter", "name email trustScore")
    .lean();

  return toPublicReports(reports as never, viewer);
}

export async function loadTask(id: string, viewer: Viewer) {
  await connectMongo();
  const report = await Report.findById(id)
    .populate("reporter", "name email trustScore")
    .lean();
  if (!report) return null;
  return toPublicReports([report] as never, viewer)[0] ?? null;
}

async function loadOwnedReport(id: string, actor: ActorContext) {
  await connectMongo();
  const report = await Report.findById(id);

  if (!report) throw new TransitionError("Task not found.");

  // A crew member may only touch their own assignment. Admins are exempt
  // because they hold the fallback resolve path.
  if (
    actor.role === "WORKER" &&
    String(report.assignedTo ?? "") !== actor.actorId
  ) {
    throw new TransitionError("This task is assigned to someone else.");
  }

  return report;
}

export async function startTask(id: string, actor: ActorContext) {
  const report = await loadOwnedReport(id, actor);
  const { to, event } = applyTransition("START", report.status, actor.role);

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = to;
      report.timeline.push({ type: event, actor: actor.actorId as never, at: now });
      await report.save({ session });

      if (report.reporterMode !== "NONE" && report.reporter) {
        await notify(
          session,
          report.reporter,
          report._id,
          "Cleanup started",
          "A crew is on site now.",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return report;
}

export async function resolveTask(
  id: string,
  actor: ActorContext,
  afterPhotoUrl?: string,
) {
  const report = await loadOwnedReport(id, actor);
  const { to, event } = applyTransition("RESOLVE", report.status, actor.role);

  // The after-photo is the proof of work the citizen was promised, so a crew
  // cannot close a task without one. Admins keep a photo-less fallback for
  // when a crew genuinely cannot update from the field.
  if (actor.role === "WORKER" && !afterPhotoUrl) {
    throw new TransitionError(
      "Add an after photo before marking this done — it is what the reporter sees.",
    );
  }

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      report.status = to;
      report.resolvedAt = now;
      if (afterPhotoUrl) report.afterPhotoUrl = afterPhotoUrl;
      report.timeline.push({
        type: event,
        actor: actor.actorId as never,
        photoUrl: afterPhotoUrl,
        note: afterPhotoUrl ? undefined : "Closed without an after photo",
        at: now,
      });
      await report.save({ session });

      if (report.reporterMode !== "NONE" && report.reporter) {
        await User.updateOne(
          { _id: report.reporter },
          { $inc: { points: POINTS_ON_RESOLVE } },
          { session },
        );

        await notify(
          session,
          report.reporter,
          report._id,
          "Resolved",
          afterPhotoUrl
            ? "The waste you reported has been cleared. There is an after photo on your report."
            : "The waste you reported has been cleared.",
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return report;
}
