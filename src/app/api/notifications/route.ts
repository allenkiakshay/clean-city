import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { Notification } from "@/models/Notification";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ notifications: [], unread: 0 });
  }

  await connectMongo();

  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return NextResponse.json({
    unread: notifications.filter((n) => !n.readAt).length,
    notifications: notifications.map((n) => ({
      id: String(n._id),
      reportId: String(n.report),
      title: n.title,
      body: n.body,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    })),
  });
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  await connectMongo();
  await Notification.updateMany(
    { user: userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );

  return NextResponse.json({ ok: true });
}
