import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { load } from "cheerio";
import {
  categoryMappings,
  productCategories,
  rawPageSnapshots,
  supplierCrawlQueue,
  supplierImages,
  supplierProducts,
  suppliers,
  supplierVariants,
  syncChanges,
  syncRuns,
  type InsertSupplier,
  type Supplier,
  type SupplierProduct,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { createWatch, getDb, updateWatch } from "../db";
import { calculatePublicPrice } from "./pricing";
import { resolveCategoryForProduct } from "./category";
import { extractWithAdapters } from "./adapters";
import { fetchSupplierPage } from "./fetch";
import { copySupplierImage, dedupeImageCandidates } from "./images";
import {
  assertSupplierScopedUrl,
  classifySupplierUrl,
  normalizeHostname,
  normalizeSupplierUrl,
  SupplierUrlSecurityError,
} from "./url";
import type { RawSupplierProduct, SupplierConfig } from "./types";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const supplierLocks = new Set<number>();
const DISCOVERY_PAGE_LIMIT = 40;
const DISCOVERY_PRODUCT_LIMIT = 25;

const DEFAULT_CATEGORIES = [
  { name: "Montres", slug: "montres" },
  { name: "Sacs", slug: "sacs" },
  { name: "Chaussures", slug: "chaussures" },
  { name: "Vetements", slug: "vetements" },
  { name: "Bijoux", slug: "bijoux" },
  { name: "Accessoires", slug: "accessoires" },
  { name: "Non classe", slug: "non-classe" },
];

async function getDatabase() {
  const db = await getDb();
  if (!db) throw new Error("PostgreSQL is required for supplier sync. Configure DATABASE_URL or DEV_DATABASE_URL.");
  return db;
}

function numberString(value: unknown, fallback?: string) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : fallback;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function now() {
  return new Date();
}

function toSupplierConfig(supplier: Supplier): SupplierConfig {
  return {
    id: supplier.id,
    privateName: supplier.privateName,
    allowedHostname: supplier.allowedHostname,
    allowedPathPrefixes: toStringArray(supplier.allowedPathPrefixes),
    catalogueUrl: supplier.catalogueUrl,
    defaultMarkupPercent: supplier.defaultMarkupPercent,
    targetCurrency: supplier.targetCurrency,
    autoPublish: supplier.autoPublish,
    autoPublishMinimumConfidence: supplier.autoPublishMinimumConfidence,
    downloadImages: supplier.downloadImages,
    priceChangeReviewThresholdPercent: supplier.priceChangeReviewThresholdPercent,
    missingProductDisableThreshold: supplier.missingProductDisableThreshold,
  };
}

async function ensureDefaultCategories(db: Db) {
  await db
    .insert(productCategories)
    .values(DEFAULT_CATEGORIES)
    .onConflictDoNothing({ target: productCategories.slug });
}

async function getSupplierOrThrow(db: Db, supplierId: number) {
  const rows = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  const supplier = rows[0];
  if (!supplier) throw new Error("Supplier not found.");
  return supplier;
}

async function createRun(db: Db, supplierId: number, type: "discovery" | "product_sync" | "manual") {
  const [run] = await db
    .insert(syncRuns)
    .values({
      supplierId,
      type,
      status: "running",
      startedAt: now(),
      heartbeatAt: now(),
    })
    .returning();
  return run;
}

async function finishRun(db: Db, runId: number, patch: Partial<typeof syncRuns.$inferInsert> = {}) {
  const [run] = await db
    .update(syncRuns)
    .set({
      ...patch,
      status: "completed",
      completedAt: now(),
      heartbeatAt: now(),
      updatedAt: now(),
    })
    .where(eq(syncRuns.id, runId))
    .returning();
  return run;
}

async function failRun(db: Db, runId: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const [run] = await db
    .update(syncRuns)
    .set({
      status: "failed",
      completedAt: now(),
      heartbeatAt: now(),
      errorsCount: sql`${syncRuns.errorsCount} + 1`,
      errorSummary: message.slice(0, 2000),
      updatedAt: now(),
    })
    .where(eq(syncRuns.id, runId))
    .returning();
  return run;
}

async function addChange(input: {
  db: Db;
  syncRunId: number;
  supplierProductId?: number | null;
  field: string;
  previousValue?: unknown;
  nextValue?: unknown;
  action: string;
  source: string;
}) {
  await input.db.insert(syncChanges).values({
    syncRunId: input.syncRunId,
    supplierProductId: input.supplierProductId ?? null,
    field: input.field,
    previousValue: input.previousValue === undefined ? null : input.previousValue,
    nextValue: input.nextValue === undefined ? null : input.nextValue,
    action: input.action,
    source: input.source,
  });
}

function visibleWatchAvailability(product: RawSupplierProduct, shouldPublish: boolean) {
  if (!shouldPublish) return "hidden" as const;
  if (product.availability === "in_stock") return "available" as const;
  if (product.availability === "out_of_stock") return "sold" as const;
  return "hidden" as const;
}

function watchTitleParts(product: RawSupplierProduct) {
  const brand = product.brand?.trim() || "Imported";
  let model = product.title.trim();
  if (product.brand && model.toLowerCase().startsWith(product.brand.toLowerCase())) {
    model = model.slice(product.brand.length).trim() || product.title.trim();
  }
  return { brand, model };
}

async function createOrUpdateWatchDraft(input: {
  supplier: SupplierConfig;
  product: RawSupplierProduct;
  supplierProduct: SupplierProduct;
  storedImageUrls: string[];
}) {
  if (input.supplierProduct.productType !== "watch") return null;

  const confidence = Number(input.supplierProduct.extractionConfidence ?? 0);
  const minConfidence = Number(input.supplier.autoPublishMinimumConfidence ?? 0.9);
  const shouldPublish =
    Boolean(input.supplier.autoPublish) &&
    confidence >= minConfidence &&
    !input.supplierProduct.priceReviewRequired &&
    input.product.availability === "in_stock";
  const { brand, model } = watchTitleParts(input.product);
  const payload = {
    brand,
    model,
    title: input.product.title,
    reference: input.product.sku ?? undefined,
    publicPrice: input.supplierProduct.priceReviewRequired
      ? undefined
      : input.supplierProduct.publicPrice ?? undefined,
    currency: input.supplierProduct.publicCurrency ?? input.supplier.targetCurrency,
    availability: visibleWatchAvailability(input.product, shouldPublish),
    visibility: shouldPublish ? "public" as const : "private" as const,
    publicationStatus: shouldPublish ? "published" as const : "draft" as const,
    category: "Supplier import",
    description: input.product.description ?? undefined,
    publicImages: input.storedImageUrls,
    importedFromUrl: true,
    supplierName: input.supplier.privateName,
    supplierDomain: input.supplier.allowedHostname,
    supplierUrl: new URL(input.supplier.catalogueUrl).origin,
    sourceUrl: input.supplierProduct.canonicalUrl,
    supplierPrice: input.supplierProduct.supplierPrice ?? undefined,
    importRawData: input.supplierProduct.rawPayload,
    importStatus: shouldPublish ? "supplier_auto_published" : "supplier_draft_created",
    importErrors: input.supplierProduct.reviewReason ? [input.supplierProduct.reviewReason] : [],
    internalNotes: `Supplier sync product ${input.supplierProduct.id}. Review before publishing.`,
  };

  if (input.supplierProduct.publicProductId) {
    return updateWatch(input.supplierProduct.publicProductId, payload);
  }

  const watch = await createWatch(payload);
  const db = await getDatabase();
  await db
    .update(supplierProducts)
    .set({ publicProductId: watch.id, status: shouldPublish ? "published" : "draft", updatedAt: now() })
    .where(eq(supplierProducts.id, input.supplierProduct.id));
  return watch;
}

async function upsertVariants(db: Db, supplierProductId: number, product: RawSupplierProduct) {
  for (const [index, variant] of product.variants.entries()) {
    const sourceVariantId = variant.sourceVariantId ?? variant.sku ?? variant.title ?? `variant-${index}`;
    await db
      .insert(supplierVariants)
      .values({
        supplierProductId,
        sourceVariantId,
        sku: variant.sku ?? null,
        title: variant.title ?? null,
        size: variant.size ?? null,
        color: variant.color ?? null,
        material: variant.material ?? null,
        options: variant.options,
        supplierPrice: variant.supplierPrice ?? null,
        currency: variant.currency ?? product.currency ?? null,
        availability: variant.availability,
        imageUrl: variant.imageUrl ?? null,
        lastSeenAt: now(),
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: [supplierVariants.supplierProductId, supplierVariants.sourceVariantId],
        set: {
          sku: variant.sku ?? null,
          title: variant.title ?? null,
          size: variant.size ?? null,
          color: variant.color ?? null,
          material: variant.material ?? null,
          options: variant.options,
          supplierPrice: variant.supplierPrice ?? null,
          currency: variant.currency ?? product.currency ?? null,
          availability: variant.availability,
          imageUrl: variant.imageUrl ?? null,
          lastSeenAt: now(),
          updatedAt: now(),
        },
      });
  }
}

async function copyAndStoreImages(input: {
  db: Db;
  supplier: SupplierConfig;
  product: RawSupplierProduct;
  supplierProductId: number;
  pageUrl: URL;
}) {
  const storedImageUrls: string[] = [];
  if (!input.supplier.downloadImages) return storedImageUrls;

  const candidates = dedupeImageCandidates(input.product.images).slice(0, 8);
  const knownHashes = new Set<string>();
  for (const [index, image] of candidates.entries()) {
    try {
      const copied = await copySupplierImage({
        image,
        pageUrl: input.pageUrl,
        supplier: input.supplier,
        supplierProductId: input.supplierProductId,
        position: index,
      });
      if (knownHashes.has(copied.imageHash)) continue;
      knownHashes.add(copied.imageHash);
      storedImageUrls.push(copied.storedUrl);
      await input.db
        .insert(supplierImages)
        .values({
          supplierProductId: input.supplierProductId,
          sourceUrl: copied.sourceUrl,
          storedUrl: copied.storedUrl,
          storageKey: copied.storageKey,
          imageHash: copied.imageHash,
          position: copied.position,
          width: copied.width ?? null,
          height: copied.height ?? null,
          status: "stored",
          updatedAt: now(),
        })
        .onConflictDoUpdate({
          target: [supplierImages.supplierProductId, supplierImages.sourceUrl],
          set: {
            storedUrl: copied.storedUrl,
            storageKey: copied.storageKey,
            imageHash: copied.imageHash,
            position: copied.position,
            width: copied.width ?? null,
            height: copied.height ?? null,
            status: "stored",
            updatedAt: now(),
          },
        });
    } catch (error) {
      const sourceUrl = (() => {
        try {
          return new URL(image.url, input.pageUrl).toString();
        } catch {
          return image.url;
        }
      })();
      await input.db
        .insert(supplierImages)
        .values({
          supplierProductId: input.supplierProductId,
          sourceUrl,
          position: index,
          status: "rejected",
          updatedAt: now(),
        })
        .onConflictDoUpdate({
          target: [supplierImages.supplierProductId, supplierImages.sourceUrl],
          set: { status: "rejected", updatedAt: now() },
        });
    }
  }
  return storedImageUrls;
}

function productStatus(product: RawSupplierProduct, priceReviewRequired: boolean, categoryConfidence: string) {
  if (priceReviewRequired) return "needs_review" as const;
  if (Number(categoryConfidence) < 0.5) return "needs_review" as const;
  if (product.confidence < 0.55) return "needs_review" as const;
  return "draft" as const;
}

async function syncProductUrl(input: {
  db: Db;
  supplier: SupplierConfig;
  syncRunId: number;
  url: string;
  force?: boolean;
}) {
  const fetchResult = await fetchSupplierPage({ url: input.url, supplier: input.supplier });
  await input.db.insert(rawPageSnapshots).values({
    supplierId: input.supplier.id,
    url: fetchResult.finalUrl.toString(),
    statusCode: fetchResult.statusCode,
    contentHash: fetchResult.contentHash,
    extractionDiagnostics: { contentType: fetchResult.contentType },
  });

  const extraction = await extractWithAdapters({
    html: fetchResult.body,
    pageUrl: fetchResult.finalUrl,
    supplier: input.supplier,
  });

  if (!extraction.product) {
    await addChange({
      db: input.db,
      syncRunId: input.syncRunId,
      field: "extraction",
      action: "rejected",
      source: extraction.adapterName ?? "adapters",
      nextValue: extraction.diagnostics,
    });
    return { rejected: 1, created: 0, updated: 0, unchanged: 0 };
  }

  const product = extraction.product;
  const canonicalUrl = normalizeSupplierUrl(product.canonicalUrl || fetchResult.finalUrl.toString()).toString();
  const existingRows = await input.db
    .select()
    .from(supplierProducts)
    .where(and(eq(supplierProducts.supplierId, input.supplier.id), eq(supplierProducts.canonicalUrl, canonicalUrl)))
    .limit(1);
  const existing = existingRows[0] ?? null;

  if (!input.force && existing?.contentHash === fetchResult.contentHash) {
    await input.db
      .update(supplierProducts)
      .set({ lastSeenAt: now(), consecutiveFailureCount: 0, updatedAt: now() })
      .where(eq(supplierProducts.id, existing.id));
    return { rejected: 0, created: 0, updated: 0, unchanged: 1 };
  }

  const categoryResolution = await resolveCategoryForProduct(input.db, input.supplier.id, product);
  const price = calculatePublicPrice({
    supplierPrice: product.supplierPrice,
    supplierCurrency: product.currency,
    supplier: input.supplier,
    category: categoryResolution.category,
    product: existing,
  });
  const locked = new Set(toStringArray(existing?.fieldLocks));
  const reviewReason = [price.reviewReason, extraction.diagnostics.length ? extraction.diagnostics.join("; ") : undefined]
    .filter(Boolean)
    .join(" ");
  const status = productStatus(product, price.priceReviewRequired, categoryResolution.confidence);
  const payload = {
    supplierId: input.supplier.id,
    publicProductId: existing?.publicProductId ?? null,
    destinationCategoryId: categoryResolution.category?.id ?? null,
    sourceProductId: product.sourceProductId ?? existing?.sourceProductId ?? null,
    canonicalUrl,
    sourceSku: locked.has("sku") ? existing?.sourceSku ?? null : product.sku ?? null,
    sourceBrand: locked.has("brand") ? existing?.sourceBrand ?? null : product.brand ?? null,
    sourceTitle: locked.has("title") ? existing?.sourceTitle ?? product.title : product.title,
    sourceDescription: locked.has("description") ? existing?.sourceDescription ?? null : product.description ?? null,
    sourceCategory: locked.has("category") ? existing?.sourceCategory ?? null : product.category ?? null,
    sourceBreadcrumbs: product.breadcrumbs,
    productType: categoryResolution.productType,
    gender: product.gender,
    condition: product.condition,
    supplierPrice: product.supplierPrice ?? null,
    supplierCurrency: product.currency ?? null,
    publicPrice: price.publicPrice,
    publicCurrency: price.publicCurrency,
    markupPercentApplied: price.markupPercentApplied,
    fixedFeeApplied: price.fixedFeeApplied,
    priceCalculatedAt: price.publicPrice ? now() : null,
    priceReviewRequired: price.priceReviewRequired,
    availability: product.availability,
    rawPayload: product.raw,
    normalizedPayload: {
      adapter: extraction.adapterName,
      categorySlug: categoryResolution.category?.slug,
      productType: categoryResolution.productType,
    },
    fieldProvenance: product.fieldProvenance,
    manualOverrides: existing?.manualOverrides ?? {},
    fieldLocks: existing?.fieldLocks ?? [],
    contentHash: fetchResult.contentHash,
    extractionConfidence: product.confidence.toFixed(2),
    categoryConfidence: categoryResolution.confidence,
    consecutiveMissingCount: 0,
    consecutiveFailureCount: 0,
    lastSeenAt: now(),
    lastSuccessfulExtractionAt: now(),
    status,
    reviewReason: reviewReason || price.reviewReason || null,
    updatedAt: now(),
  };

  const [saved] = await input.db
    .insert(supplierProducts)
    .values(payload)
    .onConflictDoUpdate({
      target: [supplierProducts.supplierId, supplierProducts.canonicalUrl],
      set: payload,
    })
    .returning();

  await addChange({
    db: input.db,
    syncRunId: input.syncRunId,
    supplierProductId: saved.id,
    field: existing ? "product" : "product",
    previousValue: existing ? { price: existing.publicPrice, availability: existing.availability } : null,
    nextValue: { price: saved.publicPrice, availability: saved.availability, status: saved.status },
    action: existing ? "updated" : "created",
    source: extraction.adapterName ?? "adapters",
  });

  await upsertVariants(input.db, saved.id, product);
  const storedImageUrls = await copyAndStoreImages({
    db: input.db,
    supplier: input.supplier,
    product,
    supplierProductId: saved.id,
    pageUrl: fetchResult.finalUrl,
  });
  await createOrUpdateWatchDraft({
    supplier: input.supplier,
    product,
    supplierProduct: saved,
    storedImageUrls,
  });

  return {
    rejected: 0,
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0,
    unchanged: 0,
  };
}

function extractLinks(html: string, pageUrl: URL, supplier: SupplierConfig) {
  const $ = load(html);
  const urls = new Set<string>();
  $("a[href], link[rel='canonical'][href]")
    .slice(0, 500)
    .each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      try {
        const url = normalizeSupplierUrl(href, pageUrl);
        if (normalizeHostname(url.hostname) !== normalizeHostname(supplier.allowedHostname)) return;
        if (classifySupplierUrl(url) === "asset") return;
        urls.add(url.toString());
      } catch {
        return;
      }
    });
  return [...urls];
}

async function sitemapUrls(db: Db, supplier: SupplierConfig, runId: number) {
  const origin = new URL(supplier.catalogueUrl).origin;
  const candidates = [`${origin}/robots.txt`, `${origin}/sitemap.xml`];
  const sitemapSet = new Set<string>();
  const productSet = new Set<string>();

  for (const candidate of candidates) {
    try {
      const result = await fetchSupplierPage({ url: candidate, supplier, maxBytes: 3_000_000 });
      if (candidate.endsWith("robots.txt")) {
        for (const line of result.body.split(/\r?\n/)) {
          const match = line.match(/^\s*sitemap:\s*(.+)$/i);
          if (match?.[1]) sitemapSet.add(normalizeSupplierUrl(match[1]).toString());
        }
      } else {
        sitemapSet.add(candidate);
      }
    } catch {
      await addChange({ db, syncRunId: runId, field: "sitemap", action: "skipped", source: "discovery", nextValue: candidate });
    }
  }

  for (const sitemap of [...sitemapSet].slice(0, 5)) {
    try {
      const result = await fetchSupplierPage({ url: sitemap, supplier, maxBytes: 8_000_000 });
      const $ = load(result.body, { xmlMode: true });
      $("loc").each((_, element) => {
        const text = $(element).text().trim();
        if (!text) return;
        try {
          const url = normalizeSupplierUrl(text);
          if (normalizeHostname(url.hostname) !== normalizeHostname(supplier.allowedHostname)) return;
          if (classifySupplierUrl(url) === "product") productSet.add(url.toString());
        } catch {
          return;
        }
      });
    } catch (error) {
      await addChange({
        db,
        syncRunId: runId,
        field: "sitemap",
        action: "failed",
        source: "discovery",
        nextValue: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return productSet;
}

async function discoverProductUrls(db: Db, supplier: SupplierConfig, runId: number) {
  const productUrls = await sitemapUrls(db, supplier, runId);
  const visited = new Set<string>();
  const queue = [normalizeSupplierUrl(supplier.catalogueUrl).toString()];

  while (queue.length && visited.size < DISCOVERY_PAGE_LIMIT && productUrls.size < DISCOVERY_PRODUCT_LIMIT * 2) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    try {
      const page = await fetchSupplierPage({ url, supplier });
      const links = extractLinks(page.body, page.finalUrl, supplier);
      for (const link of links) {
        const classified = classifySupplierUrl(new URL(link));
        if (classified === "product") productUrls.add(link);
        if ((classified === "catalogue" || classified === "unknown") && !visited.has(link)) queue.push(link);
      }
    } catch (error) {
      await addChange({
        db,
        syncRunId: runId,
        field: "crawl",
        action: "failed",
        source: "discovery",
        nextValue: { url, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  return { productUrls: [...productUrls].slice(0, DISCOVERY_PRODUCT_LIMIT), pagesVisited: visited.size };
}

async function upsertCrawlQueue(db: Db, supplierId: number, syncRunId: number, urls: string[]) {
  for (const url of urls) {
    await db
      .insert(supplierCrawlQueue)
      .values({
        supplierId,
        syncRunId,
        url,
        urlType: classifySupplierUrl(new URL(url)),
        status: "queued",
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: [supplierCrawlQueue.supplierId, supplierCrawlQueue.url],
        set: { syncRunId, status: "queued", lastError: null, updatedAt: now() },
      });
  }
}

async function markMissingProductsAfterDiscovery(db: Db, supplier: SupplierConfig, seenUrls: string[], runId: number) {
  const allProducts = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.supplierId, supplier.id));
  const seen = new Set(seenUrls);
  const threshold = Number(supplier.missingProductDisableThreshold ?? ENV.missingProductDisableThreshold);

  for (const product of allProducts) {
    if (seen.has(product.canonicalUrl)) continue;
    const nextMissing = product.consecutiveMissingCount + 1;
    const shouldDisable = nextMissing >= threshold;
    await db
      .update(supplierProducts)
      .set({
        consecutiveMissingCount: nextMissing,
        status: shouldDisable ? "unavailable" : product.status,
        availability: shouldDisable ? "out_of_stock" : product.availability,
        reviewReason: shouldDisable
          ? `Missing from ${threshold} successful discoveries; held unavailable pending confirmation.`
          : product.reviewReason,
        updatedAt: now(),
      })
      .where(eq(supplierProducts.id, product.id));
    await addChange({
      db,
      syncRunId: runId,
      supplierProductId: product.id,
      field: "missing",
      previousValue: product.consecutiveMissingCount,
      nextValue: nextMissing,
      action: shouldDisable ? "disabled_pending_review" : "missing_seen",
      source: "discovery",
    });
  }
}

export async function listSuppliers() {
  const db = await getDatabase();
  await ensureDefaultCategories(db);
  const rows = await db.select().from(suppliers).orderBy(desc(suppliers.updatedAt));
  const products = await db.select().from(supplierProducts);
  const runs = await db.select().from(syncRuns).orderBy(desc(syncRuns.createdAt));
  return rows.map((supplier) => ({
    ...supplier,
    productCount: products.filter((product) => product.supplierId === supplier.id).length,
    needsReviewCount: products.filter((product) => product.supplierId === supplier.id && product.status === "needs_review").length,
    lastRun: runs.find((run) => run.supplierId === supplier.id) ?? null,
  }));
}

export async function getSupplierDetail(id: number) {
  const db = await getDatabase();
  const supplier = await getSupplierOrThrow(db, id);
  const [products, runs] = await Promise.all([
    db.select().from(supplierProducts).where(eq(supplierProducts.supplierId, id)).orderBy(desc(supplierProducts.updatedAt)),
    db.select().from(syncRuns).where(eq(syncRuns.supplierId, id)).orderBy(desc(syncRuns.createdAt)),
  ]);
  return { supplier, products, runs };
}

export async function createSupplier(input: {
  privateName: string;
  catalogueUrl: string;
  allowedHostname?: string;
  allowedPathPrefixes?: string[];
  permissionReference?: string;
  defaultMarkupPercent?: string;
  targetCurrency?: string;
  syncIntervalMinutes?: number;
  discoveryIntervalMinutes?: number;
  maxConcurrency?: number;
  requestsPerMinute?: number;
  autoPublish?: boolean;
  autoPublishMinimumConfidence?: string;
  downloadImages?: boolean;
}) {
  const db = await getDatabase();
  await ensureDefaultCategories(db);
  const catalogueUrl = normalizeSupplierUrl(input.catalogueUrl);
  const hostname = normalizeHostname(input.allowedHostname ?? catalogueUrl.hostname);
  const supplierProbe = {
    allowedHostname: hostname,
    allowedPathPrefixes: input.allowedPathPrefixes ?? [],
  };
  await assertSupplierScopedUrl(catalogueUrl.toString(), supplierProbe);
  const values: InsertSupplier = {
    privateName: input.privateName.trim(),
    allowedHostname: hostname,
    allowedPathPrefixes: input.allowedPathPrefixes ?? [],
    catalogueUrl: catalogueUrl.toString(),
    permissionReference: input.permissionReference || null,
    defaultMarkupPercent: numberString(input.defaultMarkupPercent, "20.00")!,
    targetCurrency: (input.targetCurrency || "CHF").toUpperCase(),
    syncIntervalMinutes: input.syncIntervalMinutes ?? 30,
    discoveryIntervalMinutes: input.discoveryIntervalMinutes ?? 1440,
    maxConcurrency: input.maxConcurrency ?? 2,
    requestsPerMinute: input.requestsPerMinute ?? 30,
    autoPublish: input.autoPublish ?? false,
    autoPublishMinimumConfidence: numberString(input.autoPublishMinimumConfidence, "0.90")!,
    downloadImages: input.downloadImages ?? true,
    priceChangeReviewThresholdPercent: String(ENV.priceChangeReviewThresholdPercent),
    missingProductDisableThreshold: ENV.missingProductDisableThreshold,
  };

  const [supplier] = await db
    .insert(suppliers)
    .values(values)
    .onConflictDoUpdate({
      target: suppliers.allowedHostname,
      set: { ...values, updatedAt: now() },
    })
    .returning();
  return supplier;
}

export async function updateSupplier(id: number, input: Partial<InsertSupplier>) {
  const db = await getDatabase();
  if (input.catalogueUrl) {
    const existing = await getSupplierOrThrow(db, id);
    const probe = {
      allowedHostname: String(input.allowedHostname ?? existing.allowedHostname),
      allowedPathPrefixes: toStringArray(input.allowedPathPrefixes ?? existing.allowedPathPrefixes),
    };
    await assertSupplierScopedUrl(String(input.catalogueUrl), probe);
  }
  const [supplier] = await db
    .update(suppliers)
    .set({ ...input, updatedAt: now() })
    .where(eq(suppliers.id, id))
    .returning();
  return supplier;
}

export async function suspendSupplier(id: number) {
  return updateSupplier(id, { active: false });
}

export async function listSupplierProducts(input: { supplierId?: number; status?: string } = {}) {
  const db = await getDatabase();
  const conditions = [
    input.supplierId ? eq(supplierProducts.supplierId, input.supplierId) : undefined,
    input.status ? eq(supplierProducts.status, input.status as SupplierProduct["status"]) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({
      product: supplierProducts,
      supplier: { id: suppliers.id, privateName: suppliers.privateName },
      category: { id: productCategories.id, name: productCategories.name, slug: productCategories.slug },
    })
    .from(supplierProducts)
    .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
    .leftJoin(productCategories, eq(supplierProducts.destinationCategoryId, productCategories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supplierProducts.updatedAt));
  return rows;
}

export async function getSupplierProductDetail(id: number) {
  const db = await getDatabase();
  const [product] = await db.select().from(supplierProducts).where(eq(supplierProducts.id, id)).limit(1);
  if (!product) throw new Error("Supplier product not found.");
  const [images, variants, changes] = await Promise.all([
    db.select().from(supplierImages).where(eq(supplierImages.supplierProductId, id)).orderBy(supplierImages.position),
    db.select().from(supplierVariants).where(eq(supplierVariants.supplierProductId, id)),
    db.select().from(syncChanges).where(eq(syncChanges.supplierProductId, id)).orderBy(desc(syncChanges.createdAt)),
  ]);
  return { product, images, variants, changes };
}

export async function listCategories() {
  const db = await getDatabase();
  await ensureDefaultCategories(db);
  return db.select().from(productCategories).orderBy(productCategories.name);
}

export async function setCategoryMapping(input: {
  supplierId: number;
  sourceValue: string;
  sourceType: string;
  destinationCategoryId: number;
  productId?: number;
}) {
  const db = await getDatabase();
  await db
    .insert(categoryMappings)
    .values({
      supplierId: input.supplierId,
      sourceValue: input.sourceValue.trim(),
      sourceType: input.sourceType,
      destinationCategoryId: input.destinationCategoryId,
      confidence: "1.00",
      manuallyApproved: true,
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: [categoryMappings.supplierId, categoryMappings.sourceType, categoryMappings.sourceValue],
      set: {
        destinationCategoryId: input.destinationCategoryId,
        confidence: "1.00",
        manuallyApproved: true,
        updatedAt: now(),
      },
    });
  if (input.productId) {
    await db
      .update(supplierProducts)
      .set({
        destinationCategoryId: input.destinationCategoryId,
        categoryConfidence: "1.00",
        updatedAt: now(),
      })
      .where(eq(supplierProducts.id, input.productId));
  }
  return { success: true };
}

export async function listSyncRuns(input: { supplierId?: number } = {}) {
  const db = await getDatabase();
  const query = db.select().from(syncRuns);
  if (input.supplierId) {
    return query.where(eq(syncRuns.supplierId, input.supplierId)).orderBy(desc(syncRuns.createdAt));
  }
  return query.orderBy(desc(syncRuns.createdAt));
}

export async function runDiscoveryInline(supplierId: number) {
  const db = await getDatabase();
  if (supplierLocks.has(supplierId)) throw new Error("A sync is already running for this supplier.");
  supplierLocks.add(supplierId);
  const run = await createRun(db, supplierId, "discovery");
  try {
    const supplier = await getSupplierOrThrow(db, supplierId);
    if (!supplier.active) throw new Error("Supplier is suspended.");
    const supplierConfig = toSupplierConfig(supplier);
    const discovered = await discoverProductUrls(db, supplierConfig, run.id);
    await upsertCrawlQueue(db, supplierId, run.id, discovered.productUrls);

    let productsCreated = 0;
    let productsUpdated = 0;
    let productsUnchanged = 0;
    let productsRejected = 0;
    let errorsCount = 0;

    for (const url of discovered.productUrls) {
      try {
        await db
          .update(supplierCrawlQueue)
          .set({ status: "processing", attempts: sql`${supplierCrawlQueue.attempts} + 1`, updatedAt: now() })
          .where(and(eq(supplierCrawlQueue.supplierId, supplierId), eq(supplierCrawlQueue.url, url)));
        const result = await syncProductUrl({ db, supplier: supplierConfig, syncRunId: run.id, url });
        productsCreated += result.created;
        productsUpdated += result.updated;
        productsUnchanged += result.unchanged;
        productsRejected += result.rejected;
        await db
          .update(supplierCrawlQueue)
          .set({ status: "completed", lastError: null, updatedAt: now() })
          .where(and(eq(supplierCrawlQueue.supplierId, supplierId), eq(supplierCrawlQueue.url, url)));
      } catch (error) {
        errorsCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(supplierCrawlQueue)
          .set({ status: "failed", lastError: message.slice(0, 1000), updatedAt: now() })
          .where(and(eq(supplierCrawlQueue.supplierId, supplierId), eq(supplierCrawlQueue.url, url)));
      }
    }

    await markMissingProductsAfterDiscovery(db, supplierConfig, discovered.productUrls, run.id);
    await db
      .update(suppliers)
      .set({ lastDiscoveryAt: now(), lastSuccessfulSyncAt: now(), updatedAt: now() })
      .where(eq(suppliers.id, supplierId));
    return finishRun(db, run.id, {
      pagesVisited: discovered.pagesVisited,
      productsDiscovered: discovered.productUrls.length,
      productsCreated,
      productsUpdated,
      productsUnchanged,
      productsRejected,
      errorsCount,
    });
  } catch (error) {
    return failRun(db, run.id, error);
  } finally {
    supplierLocks.delete(supplierId);
  }
}

export async function runProductSyncInline(supplierId: number) {
  const db = await getDatabase();
  if (supplierLocks.has(supplierId)) throw new Error("A sync is already running for this supplier.");
  supplierLocks.add(supplierId);
  const run = await createRun(db, supplierId, "product_sync");
  try {
    const supplier = await getSupplierOrThrow(db, supplierId);
    if (!supplier.active) throw new Error("Supplier is suspended.");
    const supplierConfig = toSupplierConfig(supplier);
    const products = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.supplierId, supplierId))
      .orderBy(desc(supplierProducts.updatedAt));

    let productsUpdated = 0;
    let productsUnchanged = 0;
    let errorsCount = 0;

    for (const product of products.slice(0, 50)) {
      try {
        const result = await syncProductUrl({
          db,
          supplier: supplierConfig,
          syncRunId: run.id,
          url: product.canonicalUrl,
        });
        productsUpdated += result.updated;
        productsUnchanged += result.unchanged;
      } catch (error) {
        errorsCount += 1;
        await db
          .update(supplierProducts)
          .set({
            consecutiveFailureCount: sql`${supplierProducts.consecutiveFailureCount} + 1`,
            reviewReason: error instanceof SupplierUrlSecurityError
              ? error.message
              : "Network or extraction failure; last good price/stock preserved.",
            updatedAt: now(),
          })
          .where(eq(supplierProducts.id, product.id));
      }
    }

    await db
      .update(suppliers)
      .set({ lastSuccessfulSyncAt: now(), updatedAt: now() })
      .where(eq(suppliers.id, supplierId));
    return finishRun(db, run.id, {
      productsDiscovered: products.length,
      productsUpdated,
      productsUnchanged,
      errorsCount,
    });
  } catch (error) {
    return failRun(db, run.id, error);
  } finally {
    supplierLocks.delete(supplierId);
  }
}

export async function retrySupplierProduct(productId: number) {
  const db = await getDatabase();
  const [product] = await db.select().from(supplierProducts).where(eq(supplierProducts.id, productId)).limit(1);
  if (!product) throw new Error("Supplier product not found.");
  const supplier = await getSupplierOrThrow(db, product.supplierId);
  const run = await createRun(db, supplier.id, "manual");
  try {
    await syncProductUrl({
      db,
      supplier: toSupplierConfig(supplier),
      syncRunId: run.id,
      url: product.canonicalUrl,
      force: true,
    });
    return finishRun(db, run.id, { productsDiscovered: 1, productsUpdated: 1 });
  } catch (error) {
    return failRun(db, run.id, error);
  }
}

export async function createWatchDraftFromSupplierProduct(productId: number) {
  const db = await getDatabase();
  const detail = await getSupplierProductDetail(productId);
  const supplier = await getSupplierOrThrow(db, detail.product.supplierId);
  const product: RawSupplierProduct = {
    canonicalUrl: detail.product.canonicalUrl,
    sourceProductId: detail.product.sourceProductId ?? undefined,
    sku: detail.product.sourceSku ?? undefined,
    brand: detail.product.sourceBrand ?? undefined,
    title: detail.product.sourceTitle,
    description: detail.product.sourceDescription ?? undefined,
    category: detail.product.sourceCategory ?? undefined,
    breadcrumbs: toStringArray(detail.product.sourceBreadcrumbs),
    productType: detail.product.productType ?? undefined,
    gender: (detail.product.gender as RawSupplierProduct["gender"]) ?? "unknown",
    condition: detail.product.condition,
    supplierPrice: detail.product.supplierPrice ?? undefined,
    currency: detail.product.supplierCurrency ?? undefined,
    availability: detail.product.availability,
    images: [],
    variants: [],
    confidence: Number(detail.product.extractionConfidence ?? 0),
    fieldProvenance: detail.product.fieldProvenance as Record<string, unknown>,
    raw: detail.product.rawPayload as Record<string, unknown> ?? {},
  };
  return createOrUpdateWatchDraft({
    supplier: toSupplierConfig(supplier),
    product,
    supplierProduct: detail.product,
    storedImageUrls: detail.images.map((image) => image.storedUrl).filter((url): url is string => Boolean(url)),
  });
}

export async function searchCategoryMappings(input: { supplierId: number; sourceValue: string }) {
  const db = await getDatabase();
  return db
    .select()
    .from(categoryMappings)
    .where(
      and(
        eq(categoryMappings.supplierId, input.supplierId),
        ilike(categoryMappings.sourceValue, `%${input.sourceValue}%`),
      ),
    )
    .limit(20);
}
