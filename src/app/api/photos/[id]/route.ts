import { NextResponse } from "next/server";
import { readPhoto } from "@/server/photos";

/** ObjectId hex — anything else is not worth a database round trip. */
const OBJECT_ID = /^[0-9a-f]{24}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!OBJECT_ID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photo = await readPhoto(id);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.contentType,
      // Length comes from the bytes actually being sent, not the stored field —
      // a mismatch between the two is how the empty-body bug hid.
      "Content-Length": String(photo.bytes.byteLength),
      // The bytes at a given id never change, so this can be cached hard.
      // There is no CDN in front of this route, so the browser cache is the
      // only thing keeping repeat views off the database.
      "Cache-Control": "public, max-age=31536000, immutable",
      // The upload route whitelists the MIME type, but a crafted file could
      // still carry surprising bytes — never let a browser sniff its own.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
