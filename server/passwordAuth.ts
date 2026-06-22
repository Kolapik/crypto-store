import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { ONE_YEAR_MS } from "../shared/const";
import * as db from "./db";
import {
  buildConfiguredAdminUser,
  configuredAdminOpenId,
  normalizeAdminEmail,
} from "./_core/adminIdentity";
import { ENV } from "./_core/env";
import { verifyPassword } from "./_core/passwordHash";
import { sdk } from "./_core/sdk";

const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type AttemptState = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptState>();

function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];

  return (
    firstForwardedIp?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function attemptKey(req: Request, email: string) {
  return `${getClientIp(req)}:${normalizeAdminEmail(email)}`;
}

function getAttemptState(key: string) {
  const now = Date.now();
  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    attempts.set(key, fresh);
    return fresh;
  }
  return existing;
}

function assertNotRateLimited(key: string) {
  const state = getAttemptState(key);
  if (state.count >= MAX_LOGIN_ATTEMPTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Try again later.",
    });
  }
}

function recordFailedAttempt(key: string) {
  const state = getAttemptState(key);
  state.count += 1;
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

export function adminPasswordAuthConfigured() {
  return Boolean(ENV.adminEmail && ENV.adminPasswordHash);
}

export async function authenticateAdminPasswordLogin(input: {
  email: string;
  password: string;
  req: Request;
}) {
  if (!adminPasswordAuthConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Admin password login is not configured.",
    });
  }

  const key = attemptKey(input.req, input.email);
  assertNotRateLimited(key);

  const email = normalizeAdminEmail(input.email);
  const configuredEmail = normalizeAdminEmail(ENV.adminEmail);
  const emailMatches = email === configuredEmail;
  const passwordMatches = await verifyPassword(input.password, ENV.adminPasswordHash);

  if (!emailMatches || !passwordMatches) {
    recordFailedAttempt(key);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    });
  }

  const openId = configuredAdminOpenId();
  if (!openId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Admin password login is not configured.",
    });
  }

  const signedInAt = new Date();
  await db.upsertUser({
    openId,
    name: "Helvetic Reserve Admin",
    email,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: signedInAt,
  });

  const user =
    (await db.getUserByOpenId(openId)) ?? buildConfiguredAdminUser(openId);

  if (!user) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Admin login failed.",
    });
  }

  const token = await sdk.createSessionToken(openId, {
    name: user.name ?? "Helvetic Reserve Admin",
    expiresInMs: ONE_YEAR_MS,
  });

  clearAttempts(key);
  return { token, user };
}
