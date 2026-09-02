import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createReportSchema } from "@/lib/validators/report";
import { createReport } from "@/server/reports";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the report details and try again." },
      { status: 400 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const outcome = await createReport({ payload: parsed.data, userId });

  if (outcome.kind === "confirmed") {
    return NextResponse.json({
      kind: "confirmed",
      reportId: outcome.reportId,
      confirmationCount: outcome.confirmationCount,
      message: "Someone already reported this. We added your confirmation.",
    });
  }

  if (outcome.kind === "duplicate") {
    return NextResponse.json({
      kind: "duplicate",
      reportId: outcome.reportId,
      message: "This has already been reported and is being dealt with.",
    });
  }

  return NextResponse.json(
    {
      kind: "created",
      reportId: outcome.reportId,
      status: outcome.status,
      // The only time a claim token is ever returned: to the person who just
      // submitted, so they can follow a report without an account.
      claimUrl: outcome.claimToken
        ? `/reports/${outcome.reportId}?t=${outcome.claimToken}`
        : null,
    },
    { status: 201 },
  );
}
