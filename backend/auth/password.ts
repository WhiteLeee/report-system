import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function toBuffer(value: string): any {
  return Buffer.from(value, "hex");
}

export function hashPassword(password: string): any {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): any {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const actual = scryptSync(password, salt, 64);
  const expected = toBuffer(hash);
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
