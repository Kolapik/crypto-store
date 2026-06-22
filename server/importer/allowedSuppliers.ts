import type { AllowedSupplierDomain } from "./types";

export const ALLOWED_SUPPLIER_DOMAINS: AllowedSupplierDomain[] = [
  "timeworld.ch",
  "bucherer.com",
  "watchfinder.ch",
  "tawatch.ch",
  "emeraude.ch",
];

export function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function allowedSupplierDomain(hostname: string): AllowedSupplierDomain | null {
  const normalized = normalizeHostname(hostname);
  return (
    ALLOWED_SUPPLIER_DOMAINS.find(
      (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
    ) ?? null
  );
}
