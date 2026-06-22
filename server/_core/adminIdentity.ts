import { createHash } from "node:crypto";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

export function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export function configuredAdminEmail() {
  const email = normalizeAdminEmail(ENV.adminEmail);
  return email.length > 0 ? email : null;
}

export function configuredAdminOpenId() {
  const email = configuredAdminEmail();
  if (!email) return null;

  const digest = createHash("sha256").update(email).digest("hex").slice(0, 32);
  return `admin-email:${digest}`;
}

export function isConfiguredAdminOpenId(openId: string) {
  return configuredAdminOpenId() === openId;
}

export function buildConfiguredAdminUser(openId: string): User | null {
  const email = configuredAdminEmail();
  if (!email || !isConfiguredAdminOpenId(openId)) return null;

  const now = new Date();
  return {
    id: 0,
    openId,
    name: "Helvetic Reserve Admin",
    email,
    loginMethod: "password",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}
