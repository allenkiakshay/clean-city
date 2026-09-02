import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/server/errors";
import { PhotoError, storePhoto } from "@/server/photos";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 });
  }

  try {
    const stored = await storePhoto(file);
    return NextResponse.json({ url: stored.url }, { status: 201 });
  } catch (error) {
    if (error instanceof PhotoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serverErrorResponse(error, "POST /api/upload");
  }
}
