import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongo";
import { User } from "@/models/User";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration details." },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  await connectMongo();

  const existing = await User.findOne().where("email").equals(normalizedEmail);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await User.create({
    email: normalizedEmail,
    name,
    passwordHash,
    role: "CITIZEN",
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
