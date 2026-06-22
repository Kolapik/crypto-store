import { beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createPurchaseRequest } from "./db";
import type { TrpcContext } from "./_core/context";

function createContext(role: "admin" | "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-watch-test`,
      email: `${role}@example.com`,
      name: `${role} user`,
      loginMethod: "test",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin watch catalogue mutations", () => {
  beforeAll(() => {
    process.env.NO_DATABASE = "1";
  });

  it("blocks watch deletion for non-admin users", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.watches.delete({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets admins permanently delete a watch without requests", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const created = await caller.admin.watches.create({
      brand: "Delete Test",
      model: `No Requests ${Date.now()}`,
      publicationStatus: "draft",
      visibility: "private",
      status: "hidden",
      currency: "CHF",
    });

    const deleted = await caller.admin.watches.delete({ id: created.id });
    const watches = await caller.admin.watches.list();

    expect(deleted.id).toBe(created.id);
    expect(watches.some((watch) => watch.id === created.id)).toBe(false);
  });

  it("blocks hard deletion when customer requests exist", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const created = await caller.admin.watches.create({
      brand: "Delete Test",
      model: `With Request ${Date.now()}`,
      publicationStatus: "published",
      visibility: "public",
      status: "available",
      currency: "CHF",
    });

    await createPurchaseRequest({
      watchId: created.id,
      customerName: "Request Owner",
      customerEmail: "request-owner@example.com",
      preferredPaymentMethod: "crypto",
      cryptoCurrency: "btc",
    });

    await expect(caller.admin.watches.delete({ id: created.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
