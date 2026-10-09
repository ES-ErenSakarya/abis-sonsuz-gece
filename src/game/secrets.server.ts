import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export async function hashSecret(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 32)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifySecret(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = (await scrypt(password, salt, 32)) as Buffer;
  const prev = Buffer.from(hex, "hex");
  if (prev.length !== key.length) return false;
  return timingSafeEqual(prev, key);
}
