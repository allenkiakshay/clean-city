import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { claimReportSchema } from "@/lib/validators/report";
import { Report } from "@/models/Report";

/**
 * Attaches an anonymous report to an account.
 *
 * The claim token is proof the caller is the person who filed it — it was shown
 * once, at submit time, and is never returned by any other route. Claiming
 * converts the report to HIDDEN rather than NAMED: someone who chose anonymity
 * should not have their name published just because they made an account.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to claim this report." },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = claimReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid claim link." }, { status: 400 });
  }

  const { id } = await context.params;
  await connectMongo();

  const report = await Report.findById(id);

  if (!report || report.claimToken !== parsed.data.token) {
    return NextResponse.json({ error: "Invalid claim link." }, { status: 404 });
  }

  if (report.reporterMode !== "NONE") {
    return NextResponse.json(
      { error: "This report has already been claimed." },
      { status: 409 },
    );
  }

  report.reporter = userId as never;
  report.reporterMode = "HIDDEN";
  report.claimToken = undefined;
  report.timeline.push({ type: "CLAIMED", actor: userId as never, at: new Date() });
  await report.save();

  return NextResponse.json({ ok: true, reportId: String(report._id) });
}
