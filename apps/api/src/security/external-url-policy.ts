import { BadRequestException } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIpv6(host: string) {
  const normalized = host.toLowerCase();
  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isPrivateIpv4(mappedIpv4);
  }

  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  );
}

function isBlockedIpAddress(host: string) {
  if (isIP(host) === 4) return isPrivateIpv4(host);
  if (isIP(host) === 6) return isBlockedIpv6(host);
  return false;
}

type Resolver = (hostname: string, options: { all: true; verbatim: boolean }) => Promise<Array<{ address: string }>>;

export async function assertSafeExternalHttpUrl(
  raw: string,
  fieldName = "url",
  resolver: Resolver = lookup
) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new BadRequestException(`${fieldName} must use http or https`);
  }

  const host = parsed.hostname;
  if (isBlockedHostname(host)) {
    throw new BadRequestException(`${fieldName} host is not allowed`);
  }

  if (isBlockedIpAddress(host)) {
    throw new BadRequestException(`${fieldName} host is not allowed`);
  }

  if (isIP(host) === 0) {
    let resolved: Array<{ address: string }>;
    try {
      resolved = await resolver(host, { all: true, verbatim: true });
    } catch {
      throw new BadRequestException(`${fieldName} host is not resolvable`);
    }

    if (resolved.length === 0 || resolved.some((entry) => isBlockedIpAddress(entry.address))) {
      throw new BadRequestException(`${fieldName} host is not allowed`);
    }
  }
}
