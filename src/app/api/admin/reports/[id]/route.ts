import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { serverErrorResponse } from "@/server/errors";
import { TransitionError } from "@/lib/workflow";
import {
  assignReport,
  mergeReport,
  rejectReport,
  verifyReport,
} from "@/server/admin";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("VERIFY") }),
  z.object({ action: z.literal("REJECT"), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("ASSIGN"), workerId: z.string().min(1) }),
  z.object({ action: z.literal("MERGE"), targetId: z.string().min(1) }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { id } = await context.params;
  const actor = { actorId: session.user.id, role: session.user.role };

  try {
    switch (parsed.data.action) {
      case "VERIFY": {
        const report = await verifyReport(id, actor);
        return NextResponse.json({ status: report.status });
      }
      case "REJECT": {
        const report = await rejectReport(id, actor, parsed.data.note);
        return NextResponse.json({ status: report.status });
      }
      case "ASSIGN": {
        const report = await assignReport(id, actor, parsed.data.workerId);
        return NextResponse.json({ status: report.status });
      }
      case "MERGE": {
        const { report, target } = await mergeReport(id, actor, parsed.data.targetId);
        return NextResponse.json({
          status: report.status,
          mergedInto: String(target._id),
        });
      }
    }
  } catch (error) {
    // A refused transition is a normal outcome the admin needs to read, not a
    // server fault — surface the reason rather than a generic 500.
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return serverErrorResponse(error, "PATCH /api/admin/reports/[id]");
  }
}
