import { NextResponse } from "next/server";
import { z } from "zod";
import { photoRef } from "@/lib/validators/report";
import { auth } from "@/auth";
import { serverErrorResponse } from "@/server/errors";
import { TransitionError } from "@/lib/workflow";
import { resolveTask, startTask } from "@/server/worker";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START") }),
  z.object({
    action: z.literal("RESOLVE"),
    afterPhotoUrl: photoRef.optional(),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user || (role !== "WORKER" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { id } = await context.params;
  const actor = { actorId: session.user.id, role };

  try {
    const report =
      parsed.data.action === "START"
        ? await startTask(id, actor)
        : await resolveTask(id, actor, parsed.data.afterPhotoUrl);

    return NextResponse.json({ status: report.status });
  } catch (error) {
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return serverErrorResponse(error, "PATCH /api/worker/tasks/[id]");
  }
}
