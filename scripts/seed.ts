import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { hashDeviceToken } from "../src/lib/hash";
import { connectMongo } from "../src/lib/mongo";
import { Bin, User, Zone } from "../src/models";

const SEED_PASSWORD = "ChangeMe123!";

const zones = [
  {
    name: "Central Bengaluru",
    wardCode: "BLR-CEN",
    sensitivity: 12,
    centroid: [77.5946, 12.9716] as [number, number],
    area: [
      [
        [77.58, 12.96],
        [77.61, 12.96],
        [77.61, 12.985],
        [77.58, 12.985],
        [77.58, 12.96],
      ],
    ],
  },
  {
    name: "Koramangala",
    wardCode: "BLR-KOR",
    sensitivity: 10,
    centroid: [77.6245, 12.9352] as [number, number],
    area: [
      [
        [77.61, 12.92],
        [77.64, 12.92],
        [77.64, 12.95],
        [77.61, 12.95],
        [77.61, 12.92],
      ],
    ],
  },
  {
    name: "Indiranagar",
    wardCode: "BLR-IND",
    sensitivity: 14,
    centroid: [77.6412, 12.9784] as [number, number],
    area: [
      [
        [77.63, 12.965],
        [77.65, 12.965],
        [77.65, 12.99],
        [77.63, 12.99],
        [77.63, 12.965],
      ],
    ],
  },
] as const;

const binPlacements = [
  { code: "BIN-001", label: "MG Road Crossing", lng: 77.6033, lat: 12.9755 },
  { code: "BIN-002", label: "Brigade Road", lng: 77.6071, lat: 12.9698 },
  { code: "BIN-003", label: "Cubbon Park Gate", lng: 77.5925, lat: 12.9763 },
  { code: "BIN-004", label: "Koramangala 5th Block", lng: 77.624, lat: 12.935 },
  { code: "BIN-005", label: "Koramangala Forum", lng: 77.622, lat: 12.93 },
  { code: "BIN-006", label: "Sony World Signal", lng: 77.628, lat: 12.938 },
  { code: "BIN-007", label: "100 Feet Road", lng: 77.638, lat: 12.978 },
  { code: "BIN-008", label: "CMH Road", lng: 77.642, lat: 12.981 },
  { code: "BIN-009", label: "Old Airport Road", lng: 77.645, lat: 12.965 },
  { code: "BIN-010", label: "Richmond Circle", lng: 77.599, lat: 12.968 },
  { code: "BIN-011", label: "Residency Road", lng: 77.601, lat: 12.972 },
  { code: "BIN-012", label: "Ulsoor Lake", lng: 77.621, lat: 12.983 },
] as const;

function pointInPolygon(
  lng: number,
  lat: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  const ring = polygon[0];
  if (!ring) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

async function main() {
  await connectMongo();

  await Promise.all([
    User.deleteMany({}),
    Zone.deleteMany({}),
    Bin.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const createdZones = await Zone.insertMany(
    zones.map((zone) => ({
      name: zone.name,
      wardCode: zone.wardCode,
      sensitivity: zone.sensitivity,
      centroid: { type: "Point", coordinates: zone.centroid },
      area: { type: "Polygon", coordinates: zone.area },
    })),
  );

  const zoneLookup = createdZones.map((zone, index) => ({
    id: zone._id,
    area: zones[index]?.area ?? [],
  }));

  const users = await User.insertMany([
    {
      email: "admin@cleancity.local",
      name: "Municipal Admin",
      passwordHash,
      role: "ADMIN",
    },
    {
      email: "worker@cleancity.local",
      name: "Field Worker",
      passwordHash,
      role: "WORKER",
      zone: createdZones[0]?._id,
    },
    {
      email: "citizen@cleancity.local",
      name: "Citizen Reporter",
      passwordHash,
      role: "CITIZEN",
    },
  ]);

  const bins = binPlacements.map((placement, index) => {
    const zone = zoneLookup.find((candidate) =>
      pointInPolygon(placement.lng, placement.lat, candidate.area),
    );
    const token = `device-${placement.code.toLowerCase()}`;

    return {
      code: placement.code,
      label: placement.label,
      location: {
        type: "Point" as const,
        coordinates: [placement.lng, placement.lat] as [number, number],
      },
      zone: zone?.id ?? createdZones[index % createdZones.length]!._id,
      capacityLiters: 240,
      status: "ACTIVE" as const,
      device: {
        tokenHash: hashDeviceToken(token),
        batteryPercent: 88,
        firmware: "1.0.0",
      },
      latestReading: {
        fillPercent: 20 + (index % 5) * 10,
        recordedAt: new Date(),
      },
    };
  });

  await Bin.insertMany(bins);

  console.log("Seed complete.");
  console.log(`Password for all seed users: ${SEED_PASSWORD}`);
  console.log("Users:");
  for (const user of users) {
    console.log(`  ${user.role.padEnd(7)} ${user.email}`);
  }
  console.log("Device tokens (save for simulator in Phase 3):");
  for (const placement of binPlacements) {
    console.log(`  ${placement.code}: device-${placement.code.toLowerCase()}`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
