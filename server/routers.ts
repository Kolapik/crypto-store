import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archiveWatch,
  createPurchaseRequest,
  createWatch,
  getAllPurchaseRequests,
  getAllWatchesAdmin,
  getDashboardMetrics,
  getPurchaseRequestById,
  getPublicWatches,
  getWatchBrands,
  getWatchById,
  getWatchBySlug,
  updatePurchaseRequestStatus,
  updateWatch,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Slug generator
function toSlug(brand: string, model: string, ref?: string): string {
  const base = `${brand} ${model} ${ref ?? ""}`.trim();
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Public watches ──────────────────────────────────────────────────────
  watches: router({
    list: publicProcedure
      .input(z.object({
        brand: z.string().optional(),
        status: z.string().optional(),
        sort: z.string().optional(),
      }).optional())
      .query(({ input }) => getPublicWatches(input ?? {})),

    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const watch = await getWatchBySlug(input.slug);
        if (!watch) throw new TRPCError({ code: "NOT_FOUND" });
        return watch;
      }),

    brands: publicProcedure.query(() => getWatchBrands()),
  }),

  // ─── Purchase requests ────────────────────────────────────────────────────
  requests: router({
    create: publicProcedure
      .input(z.object({
        watchId: z.number(),
        customerName: z.string().min(2),
        customerEmail: z.string().email(),
        customerPhone: z.string().optional(),
        cryptoPreference: z.enum(["btc", "eth", "usdt", "none", "other"]).optional(),
        message: z.string().optional(),
      }))
      .mutation(({ input }) => createPurchaseRequest(input)),
  }),

  // ─── Admin ────────────────────────────────────────────────────────────────
  admin: router({
    metrics: adminProcedure.query(() => getDashboardMetrics()),

    watches: router({
      list: adminProcedure.query(() => getAllWatchesAdmin()),

      byId: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const watch = await getWatchById(input.id);
          if (!watch) throw new TRPCError({ code: "NOT_FOUND" });
          return watch;
        }),

      create: adminProcedure
        .input(z.object({
          brand: z.string().min(1),
          model: z.string().min(1),
          reference: z.string().optional(),
          year: z.number().optional(),
          condition: z.enum(["unworn", "excellent", "very_good", "good", "fair"]).optional(),
          price: z.string().optional(),
          currency: z.string().optional(),
          status: z.enum(["available", "reserved", "sold", "hidden"]).optional(),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          privateSource: z.string().optional(),
        }))
        .mutation(({ input }) => {
          const slug = toSlug(input.brand, input.model, input.reference);
          return createWatch({ ...input, slug });
        }),

      update: adminProcedure
        .input(z.object({
          id: z.number(),
          brand: z.string().optional(),
          model: z.string().optional(),
          reference: z.string().optional(),
          year: z.number().optional(),
          condition: z.enum(["unworn", "excellent", "very_good", "good", "fair"]).optional(),
          price: z.string().optional(),
          currency: z.string().optional(),
          status: z.enum(["available", "reserved", "sold", "hidden"]).optional(),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          privateSource: z.string().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateWatch(id, data as any);
        }),

      archive: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => archiveWatch(input.id)),
    }),

    requests: router({
      list: adminProcedure.query(() => getAllPurchaseRequests()),

      byId: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          const req = await getPurchaseRequestById(input.id);
          if (!req) throw new TRPCError({ code: "NOT_FOUND" });
          return req;
        }),

      updateStatus: adminProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["new", "reviewing", "confirmed", "declined", "completed"]),
          adminNotes: z.string().optional(),
        }))
        .mutation(({ input }) =>
          updatePurchaseRequestStatus(input.id, input.status, input.adminNotes)
        ),
    }),
  }),
});

export type AppRouter = typeof appRouter;
