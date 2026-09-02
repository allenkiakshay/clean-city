import { createHash } from "node:crypto";

export function hashValue(value: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export function hashDeviceToken(token: string): string {
  const pepper = process.env.HASH_PEPPER;
  if (!pepper) {
    throw new Error("HASH_PEPPER is not set");
  }
  return hashValue(token, pepper);
}
