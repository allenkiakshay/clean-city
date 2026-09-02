import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PhotoError,
  photoUrlFor,
  toBytes,
} from "@/lib/photo";
import { connectMongo } from "@/lib/mongo";
import { Photo } from "@/models/Photo";

/**
 * Photo storage, in MongoDB.
 *
 * One code path that behaves identically on localhost and in production, with
 * no third-party account to provision — which is what makes this a better fit
 * than object storage for a project this size. The trade is that there is no
 * CDN in front of the bytes: every view hits a function and the database.
 *
 * Photos arrive already downscaled by the browser (see `lib/image.ts`), so they
 * sit comfortably inside the 16 MB BSON document limit.
 */

export { PhotoError, MAX_PHOTO_BYTES, photoUrlFor };

export type StoredPhoto = { id: string; url: string };

export async function storePhoto(file: File): Promise<StoredPhoto> {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new PhotoError("Photos must be JPEG, PNG or WebP.");
  }

  if (file.size === 0) {
    throw new PhotoError("That file is empty.");
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoError("That photo is too large. Please retake or resize it.");
  }

  const data = Buffer.from(await file.arrayBuffer());

  await connectMongo();

  const photo = await Photo.create({
    data,
    contentType: file.type,
    size: data.byteLength,
  });

  const id = String(photo._id);
  return { id, url: photoUrlFor(id) };
}

export async function readPhoto(id: string) {
  await connectMongo();
  const photo = await Photo.findById(id).lean();
  if (!photo) return null;

  return {
    bytes: toBytes(photo.data),
    contentType: photo.contentType,
    size: photo.size,
  };
}
