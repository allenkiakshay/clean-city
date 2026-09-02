import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { ROLES } from "@/lib/types";
import { User } from "@/models/User";

const updateRoleSchema = z.object({
  role: z.enum(ROLES),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateRoleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  await connectMongo();

  const user = await User.findOne().where("_id").equals(id);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  user.role = parsed.data.role;
  await user.save();

  return NextResponse.json({
    id: user._id.toString(),
    role: user.role,
  });
}
