import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

function localAdminUser(): User | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.LOCAL_ADMIN_BYPASS !== "1"
  ) {
    return null;
  }

  const now = new Date();
  return {
    id: 0,
    openId: "local-admin-preview",
    name: "Local Admin",
    email: "owner@example.com",
    loginMethod: "local",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = localAdminUser();

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
