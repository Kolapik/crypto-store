import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archiveWatch,
  createPurchaseRequest,
  createWatch,
  deleteWatch,
  duplicateWatch,
  getAllPurchaseRequests,
  getAllWatchesAdmin,
  getDashboardMetrics,
  getPurchaseRequestById,
  getPublicWatches,
  getSystemHealth,
  getWatchBrands,
  getWatchById,
  getPublicWatchById,
  getWatchBySlug,
  updatePurchaseRequestStatus,
  updateWatch,
} from "./db";
import { importWatchFromUrl, ImportSecurityError } from "./importer/importWatch";
import { ImportFetchError } from "./importer/fetchPage";
import { notifyPurchaseRequest } from "./email";
import {
  enhanceWatchImage,
  listWatchImageEnhancements,
  useEnhancedWatchImage,
} from "./imageEnhancement";
import {
  createSupplier,
  createWatchDraftFromSupplierProduct,
  getSupplierDetail,
  getSupplierProductDetail,
  listCategories,
  listSupplierProducts,
  listSuppliers,
  listSyncRuns,
  setCategoryMapping,
  suspendSupplier,
  updateSupplier,
} from "./supplierSync/service";
import {
  enqueueDiscoveryOrRun,
  enqueueProductSyncOrRun,
  enqueueRetryProductOrRun,
  scheduleSupplierSyncJobs,
} from "./supplierSync/queue";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { authenticateAdminPasswordLogin } from "./passwordAuth";
import { createBtcpayInvoiceForRequest } from "./payments/btcpay";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

function toSlug(brand: string, model: string, ref?: string): string {
  const base = `${brand} ${model} ${ref ?? ""}`.trim();
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const watchMutationSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  title: z.string().optional(),
  reference: z.string().optional(),
  year: z.number().int().min(1900).max(2099).optional(),
  condition: z.enum(["unworn", "excellent", "very_good", "good", "fair"]).optional(),
  boxPapers: z.string().optional(),
  movement: z.string().optional(),
  caseSize: z.string().optional(),
  material: z.string().optional(),
  dialColor: z.string().optional(),
  braceletMaterial: z.string().optional(),
  price: z.string().optional(),
  publicPrice: z.string().optional(),
  currency: z.string().min(3).max(8).optional(),
  status: z.enum(["available", "reserved", "sold", "hidden"]).optional(),
  availability: z.enum(["available", "reserved", "sold", "hidden"]).optional(),
  visibility: z.enum(["public", "private", "archived"]).optional(),
  publicationStatus: z.enum(["draft", "published", "archived"]).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  hype: z.boolean().optional(),
  newArrival: z.boolean().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  publicImages: z.array(z.string()).optional(),
  importedFromUrl: z.boolean().optional(),
  privateSource: z.string().optional(),
  supplierName: z.string().optional(),
  supplierDomain: z.string().optional(),
  supplierUrl: z.string().url().optional().or(z.literal("")),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  supplierPrice: z.string().optional(),
  acquisitionCost: z.string().optional(),
  importStatus: z.string().optional(),
  importErrors: z.array(z.string()).optional(),
  internalNotes: z.string().optional(),
});

function watchInput(input: z.infer<typeof watchMutationSchema> & { brand?: string; model?: string }) {
  return {
    ...input,
    publicPrice: input.publicPrice ?? input.price,
    availability: input.availability ?? input.status,
    publicImages: input.publicImages ?? (input.imageUrl ? [input.imageUrl] : undefined),
    supplierName: input.supplierName ?? input.privateSource,
  };
}

const supplierInputSchema = z.object({
  privateName: z.string().min(2).max(200),
  catalogueUrl: z.string().url().max(2048),
  allowedHostname: z.string().max(255).optional(),
  allowedPathPrefixes: z.array(z.string().max(200)).max(20).optional(),
  permissionReference: z.string().max(1000).optional(),
  defaultMarkupPercent: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/).optional(),
  targetCurrency: z.string().min(3).max(3).optional(),
  syncIntervalMinutes: z.number().int().min(5).max(10080).optional(),
  discoveryIntervalMinutes: z.number().int().min(30).max(43200).optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  requestsPerMinute: z.number().int().min(1).max(300).optional(),
  autoPublish: z.boolean().optional(),
  autoPublishMinimumConfidence: z.string().regex(/^0(\.\d{1,2})?|1(\.0{1,2})?$/).optional(),
  downloadImages: z.boolean().optional(),
});

const supplierUpdateSchema = supplierInputSchema.partial().extend({
  id: z.number(),
  active: z.boolean().optional(),
  priceChangeReviewThresholdPercent: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/).optional(),
  missingProductDisableThreshold: z.number().int().min(1).max(20).optional(),
});

function supplierSyncError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Supplier sync failed.";
  const code = /not found/i.test(message)
    ? "NOT_FOUND"
    : /PostgreSQL|required|configure/i.test(message)
      ? "PRECONDITION_FAILED"
      : /URL|supplier|private|internal|blocked|scope|path/i.test(message)
        ? "BAD_REQUEST"
        : "INTERNAL_SERVER_ERROR";
  throw new TRPCError({ code, message });
}

function imageEnhancementError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Image enhancement failed.";
  const code = /not found/i.test(message)
    ? "NOT_FOUND"
    : /OPENAI_API_KEY|PostgreSQL|required|configured/i.test(message)
      ? "PRECONDITION_FAILED"
      : /image|URL|private|network|attached|SVG|format|larger/i.test(message)
        ? "BAD_REQUEST"
        : "INTERNAL_SERVER_ERROR";
  throw new TRPCError({ code, message });
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(8).max(512),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await authenticateAdminPasswordLogin({
          email: input.email,
          password: input.password,
          req: ctx.req,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, result.token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return result.user;
      }),
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
        model: z.string().optional(),
        status: z.string().optional(),
        availability: z.string().optional(),
        currency: z.string().optional(),
        category: z.string().optional(),
        condition: z.string().optional(),
        material: z.string().optional(),
        movement: z.string().optional(),
        boxPapers: z.string().optional(),
        dialColor: z.string().optional(),
        braceletMaterial: z.string().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        yearMin: z.number().optional(),
        yearMax: z.number().optional(),
        featured: z.boolean().optional(),
        hype: z.boolean().optional(),
        newArrival: z.boolean().optional(),
        search: z.string().optional(),
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
        customerCountry: z.string().optional(),
        message: z.string().optional(),
        preferredPaymentMethod: z.enum(["crypto", "bank_transfer", "other"]).optional(),
        cryptoCurrency: z.enum([
          "btc",
          "eth",
          "usdt",
          "usdc",
          "xmr",
          "ltc",
          "doge",
          "dash",
          "sol",
          "bnb",
          "trx",
          "matic",
          "none",
          "other",
        ]).optional(),
        cryptoPreference: z.enum([
          "btc",
          "eth",
          "usdt",
          "usdc",
          "xmr",
          "ltc",
          "doge",
          "dash",
          "sol",
          "bnb",
          "trx",
          "matic",
          "none",
          "other",
        ]).optional(),
        walletAddress: z.string().optional(),
        transactionHash: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const watch = await getPublicWatchById(input.watchId);
        if (!watch) throw new TRPCError({ code: "NOT_FOUND", message: "Watch is not available for requests" });
        const request = await createPurchaseRequest({
          ...input,
          cryptoCurrency: input.cryptoCurrency ?? input.cryptoPreference ?? "none",
          preferredPaymentMethod: input.preferredPaymentMethod ?? "crypto",
        });
        notifyPurchaseRequest(request, watch).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[Email] Purchase request notification failed: ${message}`);
        });

        try {
          const payment = await createBtcpayInvoiceForRequest({ request, watch });
          return { request, payment };
        } catch (error) {
          const message = error instanceof Error ? error.message : "BTCPay checkout could not be created.";
          console.warn(`[BTCPay] Checkout creation failed: ${message}`);
          return {
            request,
            payment: {
              enabled: true,
              processor: "btcpay" as const,
              error: "Request saved, but crypto checkout could not be created. Helvetic Reserve will contact you.",
            },
          };
        }
      }),
  }),

  // ─── Admin ────────────────────────────────────────────────────────────────
  admin: router({
    metrics: adminProcedure.query(() => getDashboardMetrics()),
    health: adminProcedure.query(() => getSystemHealth()),

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
        .input(watchMutationSchema.extend({
          brand: z.string().min(1),
          model: z.string().min(1),
        }))
        .mutation(({ input }) => {
          const slug = toSlug(input.brand, input.model, input.reference);
          return createWatch({ ...watchInput(input), brand: input.brand, model: input.model, slug });
        }),

      update: adminProcedure
        .input(watchMutationSchema.extend({ id: z.number() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateWatch(id, watchInput(data) as any);
        }),

      archive: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => archiveWatch(input.id)),

      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            const deleted = await deleteWatch(input.id);
            if (!deleted) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Watch not found." });
            }
            return deleted;
          } catch (error) {
            if (error instanceof TRPCError) throw error;
            const message = error instanceof Error ? error.message : "Watch could not be deleted.";
            const code = /customer requests/i.test(message) ? "CONFLICT" : "INTERNAL_SERVER_ERROR";
            throw new TRPCError({ code, message });
          }
        }),

      duplicate: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => duplicateWatch(input.id)),
    }),

    imports: router({
      fromUrl: adminProcedure
        .input(z.object({
          url: z.string().min(8).max(2_048),
          manualText: z.string().max(20_000).optional(),
          manualImages: z.array(z.object({
            filename: z.string().max(180),
            contentType: z.string().max(128),
            dataBase64: z.string().max(8_000_000),
          })).max(6).optional(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await importWatchFromUrl(input);
          } catch (error) {
            if (error instanceof ImportSecurityError || error instanceof ImportFetchError) {
              throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
            }
            console.error("[Importer] URL import failed", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Import failed. Create a manual draft or try again later.",
            });
          }
        }),
    }),

    imageEnhancements: router({
      listForWatch: adminProcedure
        .input(z.object({ watchId: z.number() }))
        .query(async ({ input }) => {
          try {
            return await listWatchImageEnhancements(input.watchId);
          } catch (error) {
            imageEnhancementError(error);
          }
        }),

      enhance: adminProcedure
        .input(z.object({
          watchId: z.number(),
          imageUrl: z.string().min(1).max(2048),
        }))
        .mutation(async ({ input }) => {
          try {
            return await enhanceWatchImage(input);
          } catch (error) {
            imageEnhancementError(error);
          }
        }),

      use: adminProcedure
        .input(z.object({
          watchId: z.number(),
          enhancementId: z.number(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await useEnhancedWatchImage(input);
          } catch (error) {
            imageEnhancementError(error);
          }
        }),
    }),

    suppliers: router({
      list: adminProcedure.query(async () => {
        try {
          return await listSuppliers();
        } catch (error) {
          supplierSyncError(error);
        }
      }),

      detail: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          try {
            return await getSupplierDetail(input.id);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      products: adminProcedure
        .input(z.object({
          supplierId: z.number().optional(),
          status: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
          try {
            return await listSupplierProducts(input ?? {});
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      productDetail: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          try {
            return await getSupplierProductDetail(input.id);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      categories: adminProcedure.query(async () => {
        try {
          return await listCategories();
        } catch (error) {
          supplierSyncError(error);
        }
      }),

      runs: adminProcedure
        .input(z.object({ supplierId: z.number().optional() }).optional())
        .query(async ({ input }) => {
          try {
            return await listSyncRuns(input ?? {});
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      create: adminProcedure
        .input(supplierInputSchema)
        .mutation(async ({ input }) => {
          try {
            return await createSupplier(input);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      update: adminProcedure
        .input(supplierUpdateSchema)
        .mutation(async ({ input }) => {
          try {
            const { id, ...data } = input;
            return await updateSupplier(id, data as any);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      suspend: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await suspendSupplier(input.id);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      discover: adminProcedure
        .input(z.object({ supplierId: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await enqueueDiscoveryOrRun(input.supplierId);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      sync: adminProcedure
        .input(z.object({ supplierId: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await enqueueProductSyncOrRun(input.supplierId);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      retryProduct: adminProcedure
        .input(z.object({ productId: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await enqueueRetryProductOrRun(input.productId);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      createWatchDraft: adminProcedure
        .input(z.object({ productId: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await createWatchDraftFromSupplierProduct(input.productId);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      mapCategory: adminProcedure
        .input(z.object({
          supplierId: z.number(),
          sourceValue: z.string().min(1).max(300),
          sourceType: z.string().min(1).max(64),
          destinationCategoryId: z.number(),
          productId: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await setCategoryMapping(input);
          } catch (error) {
            supplierSyncError(error);
          }
        }),

      schedule: adminProcedure.mutation(async () => {
        try {
          return await scheduleSupplierSyncJobs();
        } catch (error) {
          supplierSyncError(error);
        }
      }),
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
