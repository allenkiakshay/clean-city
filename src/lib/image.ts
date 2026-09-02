/**
 * Client-side downscale before upload.
 *
 * A modern phone photo is 4-12 MB, and a Vercel function refuses a request body
 * over 4.5 MB. Resizing in the browser keeps uploads small, fast on a phone
 * connection, and comfortably inside that limit.
 */

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;

export async function downscaleImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}
