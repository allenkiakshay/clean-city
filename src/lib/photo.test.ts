import { describe, expect, it } from "vitest";
import { PhotoError, photoUrlFor, toBytes } from "@/lib/photo";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

describe("toBytes", () => {
  it("passes a Node Buffer through intact", () => {
    expect(Array.from(toBytes(Buffer.from(PNG_MAGIC)))).toEqual(PNG_MAGIC);
  });

  it("passes a Uint8Array through intact", () => {
    expect(Array.from(toBytes(new Uint8Array(PNG_MAGIC)))).toEqual(PNG_MAGIC);
  });

  it("unwraps a BSON Binary, which is what .lean() actually returns", () => {
    // The shape that caused a 200 response with an empty body: an object
    // carrying the bytes on `.buffer` rather than being a Buffer itself.
    const binaryLike = { buffer: Buffer.from(PNG_MAGIC), sub_type: 0 };
    expect(Array.from(toBytes(binaryLike))).toEqual(PNG_MAGIC);
  });

  it("never silently returns empty bytes", () => {
    expect(() => toBytes({ nope: true })).toThrow(PhotoError);
    expect(() => toBytes(null)).toThrow(PhotoError);
    expect(() => toBytes(undefined)).toThrow(PhotoError);
  });

  it("round-trips a realistic payload without truncation", () => {
    expect(toBytes({ buffer: Buffer.alloc(300_000, 7) }).byteLength).toBe(300_000);
  });

  it("returns a body Response actually accepts", () => {
    const bytes = toBytes(Buffer.from(PNG_MAGIC));
    expect(bytes.buffer).toBeInstanceOf(ArrayBuffer);
    expect(() => new Response(bytes)).not.toThrow();
  });
});

describe("photoUrlFor", () => {
  it("builds the only shape a photo reference ever takes", () => {
    expect(photoUrlFor("6a979d1a1886a4d9517bb91a")).toBe(
      "/api/photos/6a979d1a1886a4d9517bb91a",
    );
  });
});
