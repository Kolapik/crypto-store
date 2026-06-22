import { lookup } from "node:dns/promises";
import net from "node:net";
import type { SupplierConfig } from "./types";

export class SupplierUrlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierUrlSecurityError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^mc_/i,
  /^ref$/i,
  /^ref_src$/i,
];

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

export function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function assertPublicAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4 && isPrivateIpv4(address)) {
    throw new SupplierUrlSecurityError("Supplier URL resolved to a blocked private network address.");
  }
  if (family === 6 && isPrivateIpv6(address)) {
    throw new SupplierUrlSecurityError("Supplier URL resolved to a blocked private network address.");
  }
}

function hostnameMatches(candidate: string, allowed: string) {
  const normalizedCandidate = normalizeHostname(candidate);
  const normalizedAllowed = normalizeHostname(allowed);
  if (allowed.startsWith("*.")) {
    const base = normalizeHostname(allowed.slice(2));
    return normalizedCandidate === base || normalizedCandidate.endsWith(`.${base}`);
  }
  return normalizedCandidate === normalizedAllowed;
}

function pathAllowed(url: URL, prefixes: string[]) {
  const cleaned = prefixes.map((prefix) => prefix.trim()).filter(Boolean);
  if (cleaned.length === 0) return true;
  return cleaned.some((prefix) => url.pathname.startsWith(prefix.startsWith("/") ? prefix : `/${prefix}`));
}

function stripTrackingParams(url: URL) {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
      url.searchParams.delete(key);
    }
  }
}

export function normalizeSupplierUrl(rawUrl: string, baseUrl?: URL) {
  const url = new URL(rawUrl.trim(), baseUrl);
  url.hash = "";
  stripTrackingParams(url);
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

export async function assertSupplierScopedUrl(
  rawUrl: string,
  supplier: Pick<SupplierConfig, "allowedHostname" | "allowedPathPrefixes">,
  baseUrl?: URL,
) {
  let url: URL;
  try {
    url = normalizeSupplierUrl(rawUrl, baseUrl);
  } catch {
    throw new SupplierUrlSecurityError("Enter a valid supplier URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SupplierUrlSecurityError("Only HTTP and HTTPS supplier URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new SupplierUrlSecurityError("Supplier URLs with embedded credentials are not allowed.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new SupplierUrlSecurityError("Supplier URLs with custom ports are not allowed.");
  }

  const hostname = normalizeHostname(url.hostname);
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SupplierUrlSecurityError("Local or internal URLs are not allowed.");
  }
  const directIpFamily = net.isIP(hostname);
  if (directIpFamily) {
    assertPublicAddress(hostname);
    throw new SupplierUrlSecurityError("Raw IP addresses are not approved supplier domains.");
  }
  if (!hostnameMatches(hostname, supplier.allowedHostname)) {
    throw new SupplierUrlSecurityError("URL host is outside this supplier configuration.");
  }
  if (!pathAllowed(url, supplier.allowedPathPrefixes ?? [])) {
    throw new SupplierUrlSecurityError("URL path is outside this supplier configuration.");
  }

  const resolved = await lookup(hostname, { all: true, verbatim: false });
  for (const record of resolved) assertPublicAddress(record.address);

  return url;
}

export function resolveSupplierAssetUrl(
  rawUrl: string,
  pageUrl: URL,
  supplier: Pick<SupplierConfig, "allowedHostname" | "allowedPathPrefixes">,
) {
  try {
    const url = normalizeSupplierUrl(rawUrl, pageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (!hostnameMatches(url.hostname, supplier.allowedHostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function classifySupplierUrl(url: URL) {
  const path = url.pathname.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|avif|gif|svg|pdf|zip)$/i.test(path)) return "asset";
  if (/(product|products|watch|watches|montre|montres|catalog|shop|sku|item|p\/)/i.test(path)) return "product";
  if (/(page|category|collection|collections|catalogue|catalog|shop)/i.test(path)) return "catalogue";
  return "unknown";
}
