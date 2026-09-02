import { z } from "zod";
import { toGeoJSON } from "@/lib/geo";
import { REPORT_CATEGORIES, REPORTER_MODES } from "@/lib/types";

/**
 * One schema, used verbatim by the client form and the route handler.
 *
 * This is also the single boundary where the browser's [lat, lng] becomes
 * GeoJSON [lng, lat]. Nothing downstream touches raw coordinates.
 */

/**
 * A photo reference, not an arbitrary URL.
 *
 * `z.url()` would reject this — it is a relative path — but the stricter shape
 * is the point: only photos this app stored can be attached to a report. An
 * open `z.url()` would let anyone make the site render an image from anywhere.
 */
export const photoRef = z
  .string()
  .regex(/^\/api\/photos\/[0-9a-f]{24}$/, "That is not a photo we stored.");

export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);

export const reportInputSchema = z.object({
  lat: latitude,
  lng: longitude,
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(300).optional(),
  photoUrl: photoRef.optional(),
  /**
   * What the reporter asked for. The server does not trust this — a signed-out
   * visitor is forced to NONE regardless of what they send.
   */
  requestedMode: z.enum(REPORTER_MODES).default("NAMED"),
});

export type ReportInput = z.input<typeof reportInputSchema>;

export const createReportSchema = reportInputSchema.transform((value) => ({
  ...value,
  location: toGeoJSON({ lat: value.lat, lng: value.lng }),
}));

export type CreateReportPayload = z.output<typeof createReportSchema>;

export const claimReportSchema = z.object({
  token: z.string().min(8).max(200),
});
