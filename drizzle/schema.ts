import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const watchConditionEnum = pgEnum("watch_condition", [
  "unworn",
  "excellent",
  "very_good",
  "good",
  "fair",
]);
export const watchAvailabilityEnum = pgEnum("watch_availability", [
  "available",
  "reserved",
  "sold",
  "hidden",
]);
export const watchVisibilityEnum = pgEnum("watch_visibility", [
  "public",
  "private",
  "archived",
]);
export const watchPublicationStatusEnum = pgEnum("watch_publication_status", [
  "draft",
  "published",
  "archived",
]);
export const purchaseRequestStatusEnum = pgEnum("purchase_request_status", [
  "new",
  "reviewing",
  "confirmed",
  "declined",
  "completed",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "crypto",
  "bank_transfer",
  "other",
]);
export const cryptoCurrencyEnum = pgEnum("crypto_currency", [
  "btc",
  "eth",
  "usdt",
  "usdc",
  "none",
  "other",
]);
export const imageVisibilityEnum = pgEnum("image_visibility", ["public", "private"]);
export const imageEnhancementStatusEnum = pgEnum("image_enhancement_status", [
  "processing",
  "completed",
  "failed",
]);
export const imageEnhancementReviewStatusEnum = pgEnum("image_enhancement_review_status", [
  "pending",
  "approved",
  "rejected",
]);
export const supplierProductAvailabilityEnum = pgEnum("supplier_product_availability", [
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
  "unknown",
]);
export const supplierProductStatusEnum = pgEnum("supplier_product_status", [
  "discovered",
  "draft",
  "published",
  "rejected",
  "needs_review",
  "unavailable",
  "error",
]);
export const syncRunTypeEnum = pgEnum("sync_run_type", [
  "discovery",
  "product_sync",
  "manual",
]);
export const syncRunStatusEnum = pgEnum("sync_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const crawlQueueStatusEnum = pgEnum("crawl_queue_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "skipped",
]);
export const supplierImageStatusEnum = pgEnum("supplier_image_status", [
  "pending",
  "stored",
  "failed",
  "rejected",
]);
export const fieldProvenanceSourceEnum = pgEnum("field_provenance_source", [
  "json_ld",
  "embedded_data",
  "opengraph",
  "meta",
  "supplier_selector",
  "generic_selector",
  "ai_normalized",
  "manual",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const watches = pgTable(
  "watches",
  {
    id: serial("id").primaryKey(),
    brand: varchar("brand", { length: 128 }).notNull(),
    model: varchar("model", { length: 256 }).notNull(),
    title: varchar("title", { length: 320 }),
    reference: varchar("reference", { length: 128 }),
    year: integer("year"),
    condition: watchConditionEnum("condition").default("excellent"),
    boxPapers: varchar("box_papers", { length: 128 }),
    movement: varchar("movement", { length: 128 }),
    caseSize: varchar("case_size", { length: 64 }),
    material: varchar("material", { length: 128 }),
    dialColor: varchar("dial_color", { length: 128 }),
    braceletMaterial: varchar("bracelet_material", { length: 128 }),
    publicPrice: numeric("public_price", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 8 }).default("CHF").notNull(),
    availability: watchAvailabilityEnum("availability").default("available").notNull(),
    visibility: watchVisibilityEnum("visibility").default("public").notNull(),
    publicationStatus: watchPublicationStatusEnum("publication_status").default("published").notNull(),
    category: varchar("category", { length: 128 }),
    tags: jsonb("tags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    featured: boolean("featured").default(false).notNull(),
    hype: boolean("hype").default(false).notNull(),
    newArrival: boolean("new_arrival").default(false).notNull(),
    description: text("description"),
    publicImages: jsonb("public_images")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    importedFromUrl: boolean("imported_from_url").default(false).notNull(),
    supplierName: text("supplier_name"),
    supplierDomain: text("supplier_domain"),
    supplierUrl: text("supplier_url"),
    sourceUrl: text("source_url"),
    supplierPrice: numeric("supplier_price", { precision: 14, scale: 2 }),
    acquisitionCost: numeric("acquisition_cost", { precision: 14, scale: 2 }),
    importRawData: jsonb("import_raw_data"),
    importStatus: varchar("import_status", { length: 64 }),
    importErrors: jsonb("import_errors")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    internalNotes: text("internal_notes"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    slug: varchar("slug", { length: 256 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    brandIdx: index("watches_brand_idx").on(table.brand),
    availabilityIdx: index("watches_availability_idx").on(table.availability),
    visibilityIdx: index("watches_visibility_idx").on(table.visibility),
    publicationIdx: index("watches_publication_status_idx").on(table.publicationStatus),
    categoryIdx: index("watches_category_idx").on(table.category),
  }),
);

export type Watch = typeof watches.$inferSelect;
export type InsertWatch = typeof watches.$inferInsert;

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "restrict" }),
    customerName: varchar("customer_name", { length: 256 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 64 }),
    customerCountry: varchar("customer_country", { length: 128 }),
    message: text("message"),
    preferredPaymentMethod: paymentMethodEnum("preferred_payment_method")
      .default("crypto")
      .notNull(),
    cryptoCurrency: cryptoCurrencyEnum("crypto_currency").default("none"),
    walletAddress: text("wallet_address"),
    transactionHash: text("transaction_hash"),
    status: purchaseRequestStatusEnum("status").default("new").notNull(),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    watchIdx: index("purchase_requests_watch_id_idx").on(table.watchId),
    statusIdx: index("purchase_requests_status_idx").on(table.status),
    emailIdx: index("purchase_requests_customer_email_idx").on(table.customerEmail),
  }),
);

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;

export const uploadedImages = pgTable(
  "uploaded_images",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id").references(() => watches.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    originalFilename: text("original_filename"),
    contentType: varchar("content_type", { length: 128 }),
    sizeBytes: integer("size_bytes"),
    visibility: imageVisibilityEnum("visibility").default("public").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    watchIdx: index("uploaded_images_watch_id_idx").on(table.watchId),
  }),
);

export type UploadedImage = typeof uploadedImages.$inferSelect;
export type InsertUploadedImage = typeof uploadedImages.$inferInsert;

export const imageEnhancements = pgTable(
  "image_enhancements",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    originalImageUrl: text("original_image_url").notNull(),
    enhancedImageUrl: text("enhanced_image_url"),
    storageKey: text("storage_key"),
    model: varchar("model", { length: 128 }).notNull(),
    prompt: text("prompt").notNull(),
    status: imageEnhancementStatusEnum("status").default("processing").notNull(),
    reviewStatus: imageEnhancementReviewStatusEnum("review_status").default("pending").notNull(),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    watchIdx: index("image_enhancements_watch_id_idx").on(table.watchId),
    statusIdx: index("image_enhancements_status_idx").on(table.status),
  }),
);

export type ImageEnhancement = typeof imageEnhancements.$inferSelect;
export type InsertImageEnhancement = typeof imageEnhancements.$inferInsert;

export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    parentId: integer("parent_id"),
    markupPercent: numeric("markup_percent", { precision: 8, scale: 2 }),
    fixedFee: numeric("fixed_fee", { precision: 14, scale: 2 }),
    roundingRule: varchar("rounding_rule", { length: 32 }).default("nearest_50").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    parentIdx: index("product_categories_parent_id_idx").on(table.parentId),
  }),
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    privateName: text("private_name").notNull(),
    allowedHostname: varchar("allowed_hostname", { length: 255 }).notNull(),
    allowedPathPrefixes: jsonb("allowed_path_prefixes")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    catalogueUrl: text("catalogue_url").notNull(),
    active: boolean("active").default(true).notNull(),
    permissionReference: text("permission_reference"),
    defaultMarkupPercent: numeric("default_markup_percent", { precision: 8, scale: 2 })
      .default("20.00")
      .notNull(),
    targetCurrency: varchar("target_currency", { length: 3 }).default("CHF").notNull(),
    syncIntervalMinutes: integer("sync_interval_minutes").default(30).notNull(),
    discoveryIntervalMinutes: integer("discovery_interval_minutes").default(1440).notNull(),
    maxConcurrency: integer("max_concurrency").default(2).notNull(),
    requestsPerMinute: integer("requests_per_minute").default(30).notNull(),
    autoPublish: boolean("auto_publish").default(false).notNull(),
    autoPublishMinimumConfidence: numeric("auto_publish_minimum_confidence", { precision: 4, scale: 2 })
      .default("0.90")
      .notNull(),
    downloadImages: boolean("download_images").default(true).notNull(),
    priceChangeReviewThresholdPercent: numeric("price_change_review_threshold_percent", {
      precision: 8,
      scale: 2,
    })
      .default("25.00")
      .notNull(),
    missingProductDisableThreshold: integer("missing_product_disable_threshold").default(3).notNull(),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastDiscoveryAt: timestamp("last_discovery_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    hostnameIdx: uniqueIndex("suppliers_allowed_hostname_idx").on(table.allowedHostname),
    activeIdx: index("suppliers_active_idx").on(table.active),
  }),
);

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    publicProductId: integer("public_product_id").references(() => watches.id, { onDelete: "set null" }),
    destinationCategoryId: integer("destination_category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    sourceProductId: text("source_product_id"),
    canonicalUrl: text("canonical_url").notNull(),
    sourceSku: text("source_sku"),
    sourceBrand: text("source_brand"),
    sourceTitle: text("source_title").notNull(),
    sourceDescription: text("source_description"),
    sourceCategory: text("source_category"),
    sourceBreadcrumbs: jsonb("source_breadcrumbs")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    productType: varchar("product_type", { length: 80 }),
    gender: varchar("gender", { length: 16 }).default("unknown").notNull(),
    condition: varchar("condition", { length: 32 }).default("unknown").notNull(),
    supplierPrice: numeric("supplier_price", { precision: 14, scale: 2 }),
    supplierCurrency: varchar("supplier_currency", { length: 3 }),
    publicPrice: numeric("public_price", { precision: 14, scale: 2 }),
    publicCurrency: varchar("public_currency", { length: 3 }),
    markupPercentApplied: numeric("markup_percent_applied", { precision: 8, scale: 2 }),
    fixedFeeApplied: numeric("fixed_fee_applied", { precision: 14, scale: 2 }),
    priceCalculatedAt: timestamp("price_calculated_at", { withTimezone: true }),
    priceReviewRequired: boolean("price_review_required").default(false).notNull(),
    availability: supplierProductAvailabilityEnum("availability").default("unknown").notNull(),
    rawPayload: jsonb("raw_payload"),
    normalizedPayload: jsonb("normalized_payload"),
    fieldProvenance: jsonb("field_provenance")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    manualOverrides: jsonb("manual_overrides")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    fieldLocks: jsonb("field_locks")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    contentHash: varchar("content_hash", { length: 128 }),
    extractionConfidence: numeric("extraction_confidence", { precision: 4, scale: 2 })
      .default("0.00")
      .notNull(),
    categoryConfidence: numeric("category_confidence", { precision: 4, scale: 2 })
      .default("0.00")
      .notNull(),
    consecutiveMissingCount: integer("consecutive_missing_count").default(0).notNull(),
    consecutiveFailureCount: integer("consecutive_failure_count").default(0).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSuccessfulExtractionAt: timestamp("last_successful_extraction_at", { withTimezone: true }),
    status: supplierProductStatusEnum("status").default("discovered").notNull(),
    reviewReason: text("review_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    supplierCanonicalIdx: uniqueIndex("supplier_products_supplier_canonical_idx").on(
      table.supplierId,
      table.canonicalUrl,
    ),
    supplierIdx: index("supplier_products_supplier_id_idx").on(table.supplierId),
    publicProductIdx: index("supplier_products_public_product_id_idx").on(table.publicProductId),
    statusIdx: index("supplier_products_status_idx").on(table.status),
  }),
);

export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type InsertSupplierProduct = typeof supplierProducts.$inferInsert;

export const supplierVariants = pgTable(
  "supplier_variants",
  {
    id: serial("id").primaryKey(),
    supplierProductId: integer("supplier_product_id")
      .notNull()
      .references(() => supplierProducts.id, { onDelete: "cascade" }),
    sourceVariantId: text("source_variant_id"),
    sku: text("sku"),
    title: text("title"),
    size: varchar("size", { length: 80 }),
    color: varchar("color", { length: 80 }),
    material: varchar("material", { length: 128 }),
    options: jsonb("options")
      .$type<Record<string, string>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    supplierPrice: numeric("supplier_price", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    availability: supplierProductAvailabilityEnum("availability").default("unknown").notNull(),
    imageUrl: text("image_url"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    productVariantIdx: uniqueIndex("supplier_variants_product_source_idx").on(
      table.supplierProductId,
      table.sourceVariantId,
    ),
    productIdx: index("supplier_variants_product_id_idx").on(table.supplierProductId),
  }),
);

export type SupplierVariant = typeof supplierVariants.$inferSelect;
export type InsertSupplierVariant = typeof supplierVariants.$inferInsert;

export const supplierImages = pgTable(
  "supplier_images",
  {
    id: serial("id").primaryKey(),
    supplierProductId: integer("supplier_product_id")
      .notNull()
      .references(() => supplierProducts.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    storedUrl: text("stored_url"),
    storageKey: text("storage_key"),
    imageHash: varchar("image_hash", { length: 128 }),
    position: integer("position").default(0).notNull(),
    width: integer("width"),
    height: integer("height"),
    status: supplierImageStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    productSourceIdx: uniqueIndex("supplier_images_product_source_idx").on(
      table.supplierProductId,
      table.sourceUrl,
    ),
    productIdx: index("supplier_images_product_id_idx").on(table.supplierProductId),
    hashIdx: index("supplier_images_hash_idx").on(table.imageHash),
  }),
);

export type SupplierImage = typeof supplierImages.$inferSelect;
export type InsertSupplierImage = typeof supplierImages.$inferInsert;

export const categoryMappings = pgTable(
  "category_mappings",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    sourceValue: text("source_value").notNull(),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    destinationCategoryId: integer("destination_category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    confidence: numeric("confidence", { precision: 4, scale: 2 }).default("1.00").notNull(),
    manuallyApproved: boolean("manually_approved").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    mappingIdx: uniqueIndex("category_mappings_supplier_source_idx").on(
      table.supplierId,
      table.sourceType,
      table.sourceValue,
    ),
  }),
);

export type CategoryMapping = typeof categoryMappings.$inferSelect;
export type InsertCategoryMapping = typeof categoryMappings.$inferInsert;

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    type: syncRunTypeEnum("type").notNull(),
    status: syncRunStatusEnum("status").default("queued").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    pagesVisited: integer("pages_visited").default(0).notNull(),
    productsDiscovered: integer("products_discovered").default(0).notNull(),
    productsCreated: integer("products_created").default(0).notNull(),
    productsUpdated: integer("products_updated").default(0).notNull(),
    productsUnchanged: integer("products_unchanged").default(0).notNull(),
    productsRejected: integer("products_rejected").default(0).notNull(),
    errorsCount: integer("errors_count").default(0).notNull(),
    errorSummary: text("error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    supplierStatusIdx: index("sync_runs_supplier_status_idx").on(table.supplierId, table.status),
    createdIdx: index("sync_runs_created_at_idx").on(table.createdAt),
  }),
);

export type SyncRun = typeof syncRuns.$inferSelect;
export type InsertSyncRun = typeof syncRuns.$inferInsert;

export const syncChanges = pgTable(
  "sync_changes",
  {
    id: serial("id").primaryKey(),
    syncRunId: integer("sync_run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    supplierProductId: integer("supplier_product_id").references(() => supplierProducts.id, {
      onDelete: "set null",
    }),
    field: varchar("field", { length: 128 }).notNull(),
    previousValue: jsonb("previous_value"),
    nextValue: jsonb("next_value"),
    action: varchar("action", { length: 64 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index("sync_changes_sync_run_id_idx").on(table.syncRunId),
    productIdx: index("sync_changes_supplier_product_id_idx").on(table.supplierProductId),
  }),
);

export type SyncChange = typeof syncChanges.$inferSelect;
export type InsertSyncChange = typeof syncChanges.$inferInsert;

export const rawPageSnapshots = pgTable(
  "raw_page_snapshots",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    extractedJsonLd: jsonb("extracted_json_ld"),
    extractionDiagnostics: jsonb("extraction_diagnostics"),
    storageReference: text("storage_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    supplierUrlIdx: index("raw_page_snapshots_supplier_url_idx").on(table.supplierId),
    contentHashIdx: index("raw_page_snapshots_hash_idx").on(table.contentHash),
  }),
);

export type RawPageSnapshot = typeof rawPageSnapshots.$inferSelect;
export type InsertRawPageSnapshot = typeof rawPageSnapshots.$inferInsert;

export const supplierCrawlQueue = pgTable(
  "supplier_crawl_queue",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    syncRunId: integer("sync_run_id").references(() => syncRuns.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    urlType: varchar("url_type", { length: 64 }).default("unknown").notNull(),
    status: crawlQueueStatusEnum("status").default("queued").notNull(),
    depth: integer("depth").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    contentHash: varchar("content_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    supplierUrlIdx: uniqueIndex("supplier_crawl_queue_supplier_url_idx").on(table.supplierId, table.url),
    supplierStatusIdx: index("supplier_crawl_queue_supplier_status_idx").on(table.supplierId, table.status),
  }),
);

export type SupplierCrawlQueue = typeof supplierCrawlQueue.$inferSelect;
export type InsertSupplierCrawlQueue = typeof supplierCrawlQueue.$inferInsert;
