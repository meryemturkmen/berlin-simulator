import { createHash, randomBytes } from "node:crypto";

// Per-process salt: hashed addresses cannot be reversed or correlated across deploys.
const SALT = randomBytes(16).toString("hex");

/**
 * Anonymous, non-reversible key for callers without a verified account, so
 * rate limiting works without storing or logging IP addresses.
 */
export function anonymousKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `anon:${createHash("sha256").update(SALT).update(address).digest("hex").slice(0, 24)}`;
}
