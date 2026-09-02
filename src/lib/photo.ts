/**
 * Pure photo helpers — no database, no framework, so they can be unit-tested
 * in milliseconds like the rest of the logic in `lib/`.
 */

export class PhotoError extends Error {}

export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Well under the BSON document ceiling, and under Vercel's 4.5 MB body cap. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** The only shape a photo reference ever takes. */
export function photoUrlFor(id: string): string {
  return `/api/photos/${id}`;
}

/**
 * Normalises whatever the driver hands back into real bytes.
 *
 * `.lean()` skips Mongoose's casting, so `data` comes back as a BSON `Binary`
 * rather than a Node `Buffer`. `new Uint8Array(binary)` on that silently
 * produces an EMPTY array — the response still returns 200 with a correct
 * Content-Length, and the image renders broken with no error anywhere. That
 * failure is invisible, so the conversion is explicit and tested.
 *
 * The result is copied into a fresh ArrayBuffer so it is a plain
 * `Uint8Array<ArrayBuffer>`, which is what `Response` accepts as a body.
 */
export function toBytes(data: unknown): Uint8Array<ArrayBuffer> {
  const source =
    data instanceof Uint8Array
      ? data
      : (data as { buffer?: unknown } | null)?.buffer instanceof Uint8Array
        ? ((data as { buffer: Uint8Array }).buffer)
        : null;

  if (!source) {
    throw new PhotoError("Stored photo is unreadable.");
  }

  const out = new Uint8Array(new ArrayBuffer(source.byteLength));
  out.set(source);
  return out;
}
