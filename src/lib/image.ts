/**
 * Client-side downscale before upload.
 *
 * A phone photo is 4-12 MB, and the platform refuses a request body over
 * 4.5 MB *before* any handler runs — returning a non-JSON error the app cannot
 * explain. So the job here is not "make it smaller if convenient", it is
 * "guarantee what we send is under the limit, or say why not".
 *
 * The earlier version had five paths that quietly returned the original file,
 * including when `createImageBitmap` failed — which is exactly what happens
 * with some phone photos. A 12 MB original then went at the cap and failed with
 * an unreadable error.
 */

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

/** Comfortably under the 4.5 MB platform cap, leaving room for form overhead. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Progressively harder attempts, used only if the first is still too big. */
const ATTEMPTS: { dimension: number; quality: number }[] = [
  { dimension: MAX_DIMENSION, quality: JPEG_QUALITY },
  { dimension: 1280, quality: 0.7 },
  { dimension: 1024, quality: 0.6 },
  { dimension: 800, quality: 0.5 },
];

export class ImageTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

function render(
  bitmap: ImageBitmap,
  dimension: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);

  if (!bitmap) {
    // Some formats (HEIC on certain browsers) cannot be decoded here. If the
    // original is small enough to send, send it; otherwise fail now with a
    // message, rather than letting the platform reject it unreadably.
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    throw new ImageTooLargeError(
      "This photo is too large and its format cannot be resized in the browser. " +
        "Try taking it again, or choose a JPEG.",
    );
  }

  try {
    // Already small and modest in size — nothing to gain.
    if (
      Math.max(bitmap.width, bitmap.height) <= MAX_DIMENSION &&
      file.size < 1_500_000
    ) {
      return file;
    }

    for (const attempt of ATTEMPTS) {
      const blob = await render(bitmap, attempt.dimension, attempt.quality);
      if (!blob) break;
      if (blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
          type: "image/jpeg",
        });
      }
    }

    if (file.size <= MAX_UPLOAD_BYTES) return file;

    throw new ImageTooLargeError(
      "This photo is too large to upload even after resizing. Try taking it " +
        "again at a lower resolution.",
    );
  } finally {
    bitmap.close();
  }
}
