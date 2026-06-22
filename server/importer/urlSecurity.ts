import { lookup } from "node:dns/promises";
import net from "node:net";
import { allowedSupplierDomain, normalizeHostname } from "./allowedSuppliers";
import type { AllowedSupplierDomain } from "./types";

export class ImportSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportSecurityError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((total, part) => (total << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, cidrBase: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(cidrBase) & mask);
}

function isPrivateIpv4(ip: string) {
  return (
    inIpv4Range(ip, "0.0.0.0", 8) ||
    inIpv4Range(ip, "10.0.0.0", 8) ||
    inIpv4Range(ip, "100.64.0.0", 10) ||
    inIpv4Range(ip, "127.0.0.0", 8) ||
    inIpv4Range(ip, "169.254.0.0", 16) ||
    inIpv4Range(ip, "172.16.0.0", 12) ||
    inIpv4Range(ip, "192.0.0.0", 24) ||
    inIpv4Range(ip, "192.168.0.0", 16) ||
    inIpv4Range(ip, "198.18.0.0", 15) ||
    inIpv4Range(ip, "224.0.0.0", 4)
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function assertPublicAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4 && isPrivateIpv4(address)) {
    throw new ImportSecurityError("Supplier URL resolved to a blocked private network address.");
  }
  if (family === 6 && isPrivateIpv6(address)) {
    throw new ImportSecurityError("Supplier URL resolved to a blocked private network address.");
  }
}

export async function validateSupplierUrl(rawUrl: string): Promise<{
  url: URL;
  domain: AllowedSupplierDomain;
  hostname: string;
}> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ImportSecurityError("Enter a valid supplier product URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportSecurityError("Only HTTP and HTTPS supplier URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new ImportSecurityError("Supplier URLs with embedded credentials are not allowed.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new ImportSecurityError("Supplier URLs with custom ports are not allowed.");
  }

  const hostname = normalizeHostname(url.hostname);
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new ImportSecurityError("Local or internal URLs are not allowed.");
  }

  const directIpFamily = net.isIP(hostname);
  if (directIpFamily) {
    assertPublicAddress(hostname);
    throw new ImportSecurityError("Raw IP addresses are not approved supplier domains.");
  }

  const domain = allowedSupplierDomain(hostname);
  if (!domain) {
    throw new ImportSecurityError(
      "This retailer domain is not on the allowed supplier list for imports.",
    );
  }

  const resolved = await lookup(hostname, { all: true, verbatim: false });
  for (const record of resolved) {
    assertPublicAddress(record.address);
  }

  return { url, domain, hostname };
}

export function resolveSupplierAssetUrl(rawUrl: string, baseUrl: URL) {
  const resolved = new URL(rawUrl, baseUrl);
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
  if (resolved.username || resolved.password) return null;
  const originalDomain = allowedSupplierDomain(baseUrl.hostname);
  const resolvedDomain = allowedSupplierDomain(resolved.hostname);
  if (!originalDomain || resolvedDomain !== originalDomain) return null;
  return resolved;
}
