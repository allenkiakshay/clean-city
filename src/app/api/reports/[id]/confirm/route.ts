import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { Report } from "@/models/Report";
import { OPEN_STATUSES, recomputePriority } from "@/server/reports";

/**
 * Confirming requires an account, always.
 *
 * Corroboration raises priority, so an anonymous confirmation would be a free
 * priority lever for anyone with a script. This route has no anonymous path.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to confirm a report." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  await connectMongo();

  const report = await Report.findById(id);

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (!OPEN_STATUSES.includes(report.status)) {
    return NextResponse.json(
      { error: "This report is already closed." },
      { status: 409 },
    );
  }

  if (String(report.reporter) === userId) {
    return NextResponse.json(
      { error: "You cannot confirm your own report." },
      { status: 409 },
    );
  }

  const already = (report.confirmations ?? []).some(
    (entry: { user: unknown }) => String(entry.user) === userId,
  );

  if (already) {
    return NextResponse.json(
      { error: "You have already confirmed this report." },
      { status: 409 },
    );
  }

  report.confirmations.push({ user: userId, at: new Date() });
  await recomputePriority(report);
  await report.save();

  return NextResponse.json({
    confirmationCount: report.confirmations.length,
    priorityBucket: report.priorityBucket,
  });
}
