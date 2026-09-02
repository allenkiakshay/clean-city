import { describe, expect, it } from "vitest";
import {
  gridCell,
  haversineMeters,
  isValidLatLng,
  toGeoJSON,
  toLeaflet,
} from "@/lib/geo";

// Bengaluru city centre — lat ~12.97, lng ~77.59.
const BENGALURU = { lat: 12.9755, lng: 77.6033 };

describe("coordinate order", () => {
  it("writes GeoJSON as [lng, lat], not [lat, lng]", () => {
    expect(toGeoJSON(BENGALURU)).toEqual({
      type: "Point",
      coordinates: [77.6033, 12.9755],
    });
  });

  it("reads GeoJSON back into lat/lng", () => {
    expect(toLeaflet({ type: "Point", coordinates: [77.6033, 12.9755] })).toEqual(
      BENGALURU,
    );
  });

  it("round-trips without drift", () => {
    expect(toLeaflet(toGeoJSON(BENGALURU))).toEqual(BENGALURU);
  });

  it("catches a swapped pair — 77N 12E is not a valid Bengaluru", () => {
    // If someone passes [lat, lng] where [lng, lat] is expected, the resulting
    // point lands in the Norwegian Sea. This asserts the two differ.
    const swapped = toGeoJSON({ lat: BENGALURU.lng, lng: BENGALURU.lat });
    expect(swapped.coordinates).not.toEqual(toGeoJSON(BENGALURU).coordinates);
  });
});

describe("isValidLatLng", () => {
  it("accepts real coordinates", () => {
    expect(isValidLatLng(BENGALURU)).toBe(true);
  });

  it.each([
    { lat: 91, lng: 0 },
    { lat: -91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: 0, lng: -181 },
    { lat: Number.NaN, lng: 0 },
  ])("rejects %o", (bad) => {
    expect(isValidLatLng(bad)).toBe(false);
  });
});

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(BENGALURU, BENGALURU)).toBe(0);
  });

  it("measures a short hop in metres", () => {
    // ~0.0009 degrees of latitude is very close to 100 m.
    const north = { lat: BENGALURU.lat + 0.0009, lng: BENGALURU.lng };
    expect(haversineMeters(BENGALURU, north)).toBeGreaterThan(95);
    expect(haversineMeters(BENGALURU, north)).toBeLessThan(105);
  });

  it("is symmetric", () => {
    const other = { lat: 12.98, lng: 77.61 };
    expect(haversineMeters(BENGALURU, other)).toBeCloseTo(
      haversineMeters(other, BENGALURU),
      6,
    );
  });
});

describe("gridCell", () => {
  // Coordinates chosen so they cannot straddle a boundary: with size 0.001 the
  // cell spans [12.000, 12.001), and both points sit inside it.
  const SIZE = 0.001;

  it("puts points inside the same cell together", () => {
    expect(gridCell({ lat: 12.0005, lng: 77.0005 }, SIZE)).toBe(
      gridCell({ lat: 12.0009, lng: 77.0009 }, SIZE),
    );
  });

  it("separates points across a latitude boundary", () => {
    expect(gridCell({ lat: 12.0005, lng: 77.0005 }, SIZE)).not.toBe(
      gridCell({ lat: 12.0015, lng: 77.0005 }, SIZE),
    );
  });

  it("separates points across a longitude boundary", () => {
    expect(gridCell({ lat: 12.0005, lng: 77.0005 }, SIZE)).not.toBe(
      gridCell({ lat: 12.0005, lng: 77.0015 }, SIZE),
    );
  });

  it("puts distant points in different cells at the default size", () => {
    expect(gridCell(BENGALURU)).not.toBe(gridCell({ lat: 12.99, lng: 77.62 }));
  });
});
