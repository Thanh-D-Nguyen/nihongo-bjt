import { createHash } from "node:crypto";

const UUID_NAMESPACE = "kotobaworks:bjt-production-lessons:v1";

export function stableUuid(seedKey: string): string {
  const hex = createHash("sha256")
    .update(`${UUID_NAMESPACE}:${seedKey}`)
    .digest("hex")
    .slice(0, 32);
  const chars = hex.split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

export function stableContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
