import { and, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertPurchaseRequest,
  InsertUser,
  InsertWatch,
  PurchaseRequest,
  Watch,
  purchaseRequests,
  users,
  watches,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { emailStatus } from "./email";

const LOCAL_DATABASE_URL =
  process.env.DEV_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/helvetic_reserve";

const PRIVATE_WATCH_FIELDS = [
  "supplierName",
  "supplierDomain",
  "supplierUrl",
  "sourceUrl",
  "supplierPrice",
  "acquisitionCost",
  "importRawData",
  "importStatus",
  "importErrors",
  "internalNotes",
  "importedFromUrl",
  "importedAt",
  "lastCheckedAt",
  "privateSource",
] as const;

type Db = ReturnType<typeof drizzle>;
type Availability = "available" | "reserved" | "sold" | "hidden";
type Visibility = "public" | "private" | "archived";
type PublicationStatus = "draft" | "published" | "archived";
type RequestStatus = "new" | "reviewing" | "confirmed" | "declined" | "completed";
type CryptoCurrency =
  | "btc"
  | "eth"
  | "usdt"
  | "usdc"
  | "xmr"
  | "ltc"
  | "doge"
  | "dash"
  | "sol"
  | "bnb"
  | "trx"
  | "matic"
  | "none"
  | "other";
type PaymentMethod = "crypto" | "bank_transfer" | "other";
type PaymentUpdate = Partial<
  Pick<
    InsertPurchaseRequest,
    | "paymentProcessor"
    | "paymentInvoiceId"
    | "paymentCheckoutUrl"
    | "paymentStatus"
    | "paymentAmount"
    | "paymentCurrency"
    | "paymentInvoiceCreatedAt"
    | "paymentInvoiceExpiresAt"
    | "paymentSettledAt"
    | "paymentRawData"
    | "status"
    | "adminNotes"
  >
>;

export type PublicWatch = Omit<
  Watch,
  | (typeof PRIVATE_WATCH_FIELDS)[number]
  | "supplierName"
  | "supplierDomain"
  | "supplierUrl"
  | "sourceUrl"
  | "supplierPrice"
  | "acquisitionCost"
  | "importRawData"
  | "importStatus"
  | "importErrors"
  | "internalNotes"
  | "importedFromUrl"
  | "importedAt"
  | "lastCheckedAt"
  | "publicationStatus"
> & {
  price: string | null;
  status: Availability;
  imageUrl: string | null;
};

export type AdminWatch = Watch & {
  price: string | null;
  status: Availability;
  imageUrl: string | null;
  privateSource: string | null;
};

export type PurchaseRequestDto = PurchaseRequest & {
  cryptoPreference: CryptoCurrency | null;
};

export type PublicWatchFilters = {
  brand?: string;
  model?: string;
  status?: string;
  availability?: string;
  currency?: string;
  category?: string;
  condition?: string;
  material?: string;
  movement?: string;
  boxPapers?: string;
  dialColor?: string;
  braceletMaterial?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  featured?: boolean;
  hype?: boolean;
  newArrival?: boolean;
  search?: string;
  sort?: string;
};

let pool: Pool | null = null;
let db: Db | null = null;
let dbState: "unknown" | "connected" | "unavailable" = "unknown";
let warnedUnavailable = false;

function databaseUrl() {
  return ENV.databaseUrl || LOCAL_DATABASE_URL;
}

function warnDbUnavailable(error: unknown) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[Database] PostgreSQL unavailable, using local demo data: ${message}`);
}

export async function getDb() {
  if (process.env.NO_DATABASE === "1") return null;
  if (dbState === "connected" && db) return db;
  if (dbState === "unavailable") return null;

  try {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 1_500,
    });
    await pool.query("select 1");
    db = drizzle(pool);
    dbState = "connected";
    return db;
  } catch (error) {
    dbState = "unavailable";
    db = null;
    await pool?.end().catch(() => undefined);
    pool = null;
    warnDbUnavailable(error);
    return null;
  }
}

async function withDb<T>(operation: (database: Db) => Promise<T>, fallback: () => T): Promise<T> {
  const database = await getDb();
  if (!database) return fallback();

  try {
    return await operation(database);
  } catch (error) {
    warnDbUnavailable(error);
    return fallback();
  }
}

function now() {
  return new Date();
}

function toSlug(brand: string, model: string, reference?: string | null): string {
  return `${brand} ${model} ${reference ?? ""}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(base: string, id: number) {
  return `${base}-${id}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function imageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function firstImage(watch: Pick<Watch, "publicImages">) {
  return imageList(watch.publicImages)[0] ?? null;
}

export function toPublicWatch(watch: Watch): PublicWatch {
  const publicImages = imageList(watch.publicImages);

  return {
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    title: watch.title,
    reference: watch.reference,
    year: watch.year,
    condition: watch.condition,
    boxPapers: watch.boxPapers,
    movement: watch.movement,
    caseSize: watch.caseSize,
    material: watch.material,
    dialColor: watch.dialColor,
    braceletMaterial: watch.braceletMaterial,
    publicPrice: watch.publicPrice,
    currency: watch.currency,
    availability: watch.availability,
    visibility: watch.visibility,
    category: watch.category,
    tags: imageList(watch.tags),
    featured: watch.featured,
    hype: watch.hype,
    newArrival: watch.newArrival,
    description: watch.description,
    publicImages,
    slug: watch.slug,
    createdAt: watch.createdAt,
    updatedAt: watch.updatedAt,
    price: watch.publicPrice,
    status: watch.availability,
    imageUrl: publicImages[0] ?? null,
  };
}

function toAdminWatch(watch: Watch): AdminWatch {
  return {
    ...watch,
    publicImages: imageList(watch.publicImages),
    price: watch.publicPrice,
    status: watch.availability,
    imageUrl: firstImage(watch),
    privateSource: watch.supplierName ?? watch.sourceUrl ?? null,
  };
}

function toPurchaseDto(request: PurchaseRequest): PurchaseRequestDto {
  return {
    ...request,
    cryptoPreference: request.cryptoCurrency ?? "none",
  };
}

function numericPrice(watch: Pick<Watch, "publicPrice">) {
  if (watch.publicPrice === null) return null;
  const value = Number(watch.publicPrice);
  return Number.isFinite(value) ? value : null;
}

function normalizeComparable(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function hasTextMatch(value: unknown, needle: string) {
  return normalizeComparable(value).includes(needle);
}

function publicFilter(watch: Watch, filters?: PublicWatchFilters) {
  if (watch.publicationStatus !== "published") return false;
  if (watch.visibility !== "public") return false;
  if (watch.availability === "hidden") return false;
  if (filters?.brand && watch.brand !== filters.brand) return false;
  const requestedStatus = filters?.availability ?? filters?.status;
  if (requestedStatus && requestedStatus !== "all" && watch.availability !== requestedStatus) return false;
  if (filters?.model && !hasTextMatch(watch.model, normalizeComparable(filters.model))) return false;
  if (filters?.currency && watch.currency !== filters.currency) return false;
  if (filters?.category && watch.category !== filters.category) return false;
  if (filters?.condition && watch.condition !== filters.condition) return false;
  if (filters?.material && !hasTextMatch(watch.material, normalizeComparable(filters.material))) return false;
  if (filters?.movement && !hasTextMatch(watch.movement, normalizeComparable(filters.movement))) return false;
  if (filters?.boxPapers && !hasTextMatch(watch.boxPapers, normalizeComparable(filters.boxPapers))) return false;
  if (filters?.dialColor && !hasTextMatch(watch.dialColor, normalizeComparable(filters.dialColor))) return false;
  if (
    filters?.braceletMaterial &&
    !hasTextMatch(watch.braceletMaterial, normalizeComparable(filters.braceletMaterial))
  ) {
    return false;
  }
  if (filters?.featured !== undefined && watch.featured !== filters.featured) return false;
  if (filters?.hype !== undefined && watch.hype !== filters.hype) return false;
  if (filters?.newArrival !== undefined && watch.newArrival !== filters.newArrival) return false;
  if (filters?.priceMin !== undefined || filters?.priceMax !== undefined) {
    const price = numericPrice(watch);
    if (price === null) return false;
    if (filters.priceMin !== undefined && price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && price > filters.priceMax) return false;
  }
  if (filters?.yearMin !== undefined && (!watch.year || watch.year < filters.yearMin)) return false;
  if (filters?.yearMax !== undefined && (!watch.year || watch.year > filters.yearMax)) return false;
  if (filters?.search) {
    const needle = normalizeComparable(filters.search);
    const haystack = [
      watch.brand,
      watch.model,
      watch.title,
      watch.reference,
      watch.description,
      watch.category,
      ...(Array.isArray(watch.tags) ? watch.tags : []),
    ];
    if (!haystack.some((value) => hasTextMatch(value, needle))) return false;
  }
  return true;
}

function sortPublicWatches(rows: Watch[], sort = "featured") {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sort === "price_asc") {
      const ap = numericPrice(a);
      const bp = numericPrice(b);
      if (ap === null && bp === null) return 0;
      if (ap === null) return 1;
      if (bp === null) return -1;
      return ap - bp;
    }
    if (sort === "price_desc") {
      const ap = numericPrice(a);
      const bp = numericPrice(b);
      if (ap === null && bp === null) return 0;
      if (ap === null) return 1;
      if (bp === null) return -1;
      return bp - ap;
    }
    if (sort === "brand_az") {
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
    }
    if (sort === "newest") {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    return (
      Number(b.featured) - Number(a.featured) ||
      Number(b.hype) - Number(a.hype) ||
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  });
  return sorted;
}

const demoWatches: Watch[] = [
  {
    id: 1,
    brand: "Rolex",
    model: "Cosmograph Daytona",
    title: "Rolex Cosmograph Daytona 116500LN",
    reference: "116500LN",
    year: 2023,
    condition: "excellent",
    boxPapers: "Full set",
    movement: "Automatic chronograph",
    caseSize: "40 mm",
    material: "Oystersteel / Cerachrom",
    dialColor: "White",
    braceletMaterial: "Oystersteel",
    publicPrice: "29500.00",
    currency: "CHF",
    availability: "available",
    visibility: "public",
    publicationStatus: "published",
    category: "Rolex",
    tags: ["Rolex", "Daytona", "Hype pieces"],
    featured: true,
    hype: true,
    newArrival: true,
    description:
      "White dial Daytona with full set presentation. Availability and final price are confirmed manually before payment instructions are issued.",
    publicImages: ["/images/hero/ocean-dark.jpg"],
    importedFromUrl: false,
    supplierName: "Private Geneva source",
    supplierDomain: null,
    supplierUrl: "https://supplier-private.example/daytona",
    sourceUrl: "https://source-private.example/listing/daytona",
    supplierPrice: "27400.00",
    acquisitionCost: "28000.00",
    importRawData: null,
    importStatus: "seeded",
    importErrors: [],
    internalNotes: "Demo private data. Must never appear in public responses.",
    importedAt: null,
    lastCheckedAt: null,
    slug: "rolex-cosmograph-daytona-116500ln",
    createdAt: new Date("2026-01-08T10:00:00Z"),
    updatedAt: new Date("2026-01-08T10:00:00Z"),
  },
  {
    id: 2,
    brand: "Patek Philippe",
    model: "Aquanaut",
    title: "Patek Philippe Aquanaut 5167A-001",
    reference: "5167A-001",
    year: 2021,
    condition: "very_good",
    boxPapers: "Box and papers",
    movement: "Automatic",
    caseSize: "40.8 mm",
    material: "Stainless steel / rubber",
    dialColor: "Black",
    braceletMaterial: "Rubber",
    publicPrice: "52500.00",
    currency: "CHF",
    availability: "reserved",
    visibility: "public",
    publicationStatus: "published",
    category: "Patek Philippe",
    tags: ["Patek Philippe", "Aquanaut", "Hype pieces"],
    featured: true,
    hype: true,
    newArrival: false,
    description:
      "Request-based reserved listing. A new availability check is required before any sale can proceed.",
    publicImages: ["/images/hero/forest-dark.jpg"],
    importedFromUrl: false,
    supplierName: "Private Zurich source",
    supplierDomain: null,
    supplierUrl: "https://supplier-private.example/aquanaut",
    sourceUrl: "https://source-private.example/listing/aquanaut",
    supplierPrice: "49600.00",
    acquisitionCost: "50200.00",
    importRawData: null,
    importStatus: "seeded",
    importErrors: [],
    internalNotes: "Demo margin and source notes remain admin-only.",
    importedAt: null,
    lastCheckedAt: null,
    slug: "patek-philippe-aquanaut-5167a-001",
    createdAt: new Date("2026-01-05T10:00:00Z"),
    updatedAt: new Date("2026-01-05T10:00:00Z"),
  },
  {
    id: 3,
    brand: "Audemars Piguet",
    model: "Royal Oak Selfwinding",
    title: "Audemars Piguet Royal Oak Selfwinding 15500ST.OO.1220ST.01",
    reference: "15500ST.OO.1220ST.01",
    year: 2020,
    condition: "excellent",
    boxPapers: "Full set",
    movement: "Automatic",
    caseSize: "41 mm",
    material: "Stainless steel",
    dialColor: "Blue",
    braceletMaterial: "Stainless steel",
    publicPrice: "39800.00",
    currency: "CHF",
    availability: "available",
    visibility: "public",
    publicationStatus: "published",
    category: "Audemars Piguet",
    tags: ["Audemars Piguet", "Royal Oak", "Hype pieces"],
    featured: true,
    hype: true,
    newArrival: false,
    description:
      "Blue dial Royal Oak listed for manual request. KYC and payment review may be required before completion.",
    publicImages: ["/images/hero/forest-dark2.jpg"],
    importedFromUrl: false,
    supplierName: "EU private collection",
    supplierDomain: null,
    supplierUrl: "https://supplier-private.example/royal-oak",
    sourceUrl: "https://source-private.example/listing/royal-oak",
    supplierPrice: "37100.00",
    acquisitionCost: "37950.00",
    importRawData: null,
    importStatus: "seeded",
    importErrors: [],
    internalNotes: "Demo compliance review note. Internal only.",
    importedAt: null,
    lastCheckedAt: null,
    slug: "audemars-piguet-royal-oak-selfwinding-15500st-oo-1220st-01",
    createdAt: new Date("2026-01-03T10:00:00Z"),
    updatedAt: new Date("2026-01-03T10:00:00Z"),
  },
];

const demoRequests: PurchaseRequest[] = [];

function nextWatchId() {
  return Math.max(0, ...demoWatches.map((watch) => watch.id)) + 1;
}

function nextRequestId() {
  return Math.max(0, ...demoRequests.map((request) => request.id)) + 1;
}

function normalizeWatchInput(data: Partial<InsertWatch> & Record<string, unknown>): Partial<InsertWatch> {
  const normalized: Partial<InsertWatch> = { ...data };
  const raw = data as Record<string, unknown>;

  if (typeof raw.price === "string") normalized.publicPrice = raw.price || null;
  if (typeof raw.status === "string") normalized.availability = raw.status as Availability;
  if (typeof raw.imageUrl === "string") normalized.publicImages = raw.imageUrl ? [raw.imageUrl] : [];
  if (typeof raw.privateSource === "string") normalized.supplierName = raw.privateSource || null;
  if (typeof raw.tags === "string") {
    normalized.tags = raw.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw.tags)) {
    normalized.tags = raw.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }
  if (Array.isArray(raw.publicImages)) {
    normalized.publicImages = imageList(raw.publicImages);
  }
  if (Array.isArray(raw.importErrors)) {
    normalized.importErrors = raw.importErrors.filter(
      (error): error is string => typeof error === "string" && error.trim().length > 0,
    );
  }

  delete (normalized as Record<string, unknown>).price;
  delete (normalized as Record<string, unknown>).status;
  delete (normalized as Record<string, unknown>).imageUrl;
  delete (normalized as Record<string, unknown>).privateSource;

  return normalized;
}

function normalizeRequestInput(
  data: Partial<InsertPurchaseRequest> & Record<string, unknown>,
): InsertPurchaseRequest {
  const normalized: InsertPurchaseRequest = {
    watchId: Number(data.watchId),
    customerName: String(data.customerName ?? ""),
    customerEmail: String(data.customerEmail ?? ""),
    customerPhone: typeof data.customerPhone === "string" ? data.customerPhone || null : null,
    customerCountry: typeof data.customerCountry === "string" ? data.customerCountry || null : null,
    preferredPaymentMethod:
      (data.preferredPaymentMethod as PaymentMethod | undefined) ??
      (data.cryptoPreference && data.cryptoPreference !== "none" ? "crypto" : "crypto"),
    cryptoCurrency:
      (data.cryptoCurrency as CryptoCurrency | undefined) ??
      (data.cryptoPreference as CryptoCurrency | undefined) ??
      "none",
    walletAddress: typeof data.walletAddress === "string" ? data.walletAddress || null : null,
    transactionHash: typeof data.transactionHash === "string" ? data.transactionHash || null : null,
    message: typeof data.message === "string" ? data.message || null : null,
  };

  if (data.status) normalized.status = data.status as RequestStatus;
  if (typeof data.adminNotes === "string") normalized.adminNotes = data.adminNotes || null;
  return normalized;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  await withDb(
    async (database) => {
      const nowDate = now();
      const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");

      await database
        .insert(users)
        .values({
          openId: user.openId,
          name: user.name ?? null,
          email: user.email ?? null,
          loginMethod: user.loginMethod ?? null,
          role,
          lastSignedIn: user.lastSignedIn ?? nowDate,
          updatedAt: nowDate,
        })
        .onConflictDoUpdate({
          target: users.openId,
          set: {
            name: user.name ?? null,
            email: user.email ?? null,
            loginMethod: user.loginMethod ?? null,
            role,
            lastSignedIn: user.lastSignedIn ?? nowDate,
            updatedAt: nowDate,
          },
        });
    },
    () => undefined,
  );
}

export async function getUserByOpenId(openId: string) {
  return withDb(
    async (database) => {
      const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    },
    () => undefined,
  );
}

export async function getPublicWatches(filters?: PublicWatchFilters) {
  return withDb(
    async (database) => {
      const conditions = [
        eq(watches.publicationStatus, "published" as PublicationStatus),
        eq(watches.visibility, "public" as Visibility),
        ne(watches.availability, "hidden" as Availability),
      ];

      if (filters?.brand) conditions.push(eq(watches.brand, filters.brand));
      const requestedStatus = filters?.availability ?? filters?.status;
      if (requestedStatus && requestedStatus !== "all") {
        conditions.push(eq(watches.availability, requestedStatus as Availability));
      }

      const rows = await database
        .select()
        .from(watches)
        .where(and(...conditions))
        .orderBy(desc(watches.featured), desc(watches.createdAt));
      return sortPublicWatches(rows.filter((watch) => publicFilter(watch, filters)), filters?.sort).map(toPublicWatch);
    },
    () =>
      sortPublicWatches(
        demoWatches.filter((watch) => publicFilter(watch, filters)),
        filters?.sort,
      ).map(toPublicWatch),
  );
}

export async function getWatchBySlug(slug: string) {
  return withDb(
    async (database) => {
      const result = await database
        .select()
        .from(watches)
        .where(
          and(
            eq(watches.slug, slug),
            eq(watches.publicationStatus, "published" as PublicationStatus),
            eq(watches.visibility, "public" as Visibility),
            ne(watches.availability, "hidden" as Availability),
          ),
        )
        .limit(1);
      return result.length > 0 ? toPublicWatch(result[0]) : undefined;
    },
    () => {
      const watch = demoWatches.find((item) => item.slug === slug && publicFilter(item));
      return watch ? toPublicWatch(watch) : undefined;
    },
  );
}

export async function getPublicWatchById(id: number) {
  return withDb(
    async (database) => {
      const result = await database
        .select()
        .from(watches)
        .where(
          and(
            eq(watches.id, id),
            eq(watches.publicationStatus, "published" as PublicationStatus),
            eq(watches.visibility, "public" as Visibility),
            ne(watches.availability, "hidden" as Availability),
          ),
        )
        .limit(1);
      return result.length > 0 ? toPublicWatch(result[0]) : undefined;
    },
    () => {
      const watch = demoWatches.find((item) => item.id === id && publicFilter(item));
      return watch ? toPublicWatch(watch) : undefined;
    },
  );
}

export async function getWatchById(id: number) {
  return withDb(
    async (database) => {
      const result = await database.select().from(watches).where(eq(watches.id, id)).limit(1);
      return result.length > 0 ? toAdminWatch(result[0]) : undefined;
    },
    () => {
      const watch = demoWatches.find((item) => item.id === id);
      return watch ? toAdminWatch(watch) : undefined;
    },
  );
}

export async function getAllWatchesAdmin() {
  return withDb(
    async (database) => {
      const rows = await database.select().from(watches).orderBy(desc(watches.createdAt));
      return rows.map(toAdminWatch);
    },
    () => [...demoWatches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toAdminWatch),
  );
}

export async function createWatch(
  data: Partial<InsertWatch> & Record<string, unknown> & { brand: string; model: string; slug?: string },
) {
  const payload = normalizeWatchInput(data);
  const slug = payload.slug ?? toSlug(String(payload.brand), String(payload.model), payload.reference);
  const insertData = { ...payload, slug } as InsertWatch;

  return withDb(
    async (database) => {
      const result = await database.insert(watches).values(insertData).returning();
      return toAdminWatch(result[0]);
    },
    () => {
      const id = nextWatchId();
      const createdAt = now();
      const watch: Watch = {
        id,
        brand: String(insertData.brand),
        model: String(insertData.model),
        title: insertData.title ?? null,
        reference: insertData.reference ?? null,
        year: insertData.year ?? null,
        condition: insertData.condition ?? "excellent",
        boxPapers: insertData.boxPapers ?? null,
        movement: insertData.movement ?? null,
        caseSize: insertData.caseSize ?? null,
        material: insertData.material ?? null,
        dialColor: insertData.dialColor ?? null,
        braceletMaterial: insertData.braceletMaterial ?? null,
        publicPrice: insertData.publicPrice ?? null,
        currency: insertData.currency ?? "CHF",
        availability: insertData.availability ?? "available",
        visibility: insertData.visibility ?? "public",
        publicationStatus: insertData.publicationStatus ?? "published",
        category: insertData.category ?? null,
        tags: imageList(insertData.tags),
        featured: insertData.featured ?? false,
        hype: insertData.hype ?? false,
        newArrival: insertData.newArrival ?? false,
        description: insertData.description ?? null,
        publicImages: imageList(insertData.publicImages),
        importedFromUrl: insertData.importedFromUrl ?? false,
        supplierName: insertData.supplierName ?? null,
        supplierDomain: insertData.supplierDomain ?? null,
        supplierUrl: insertData.supplierUrl ?? null,
        sourceUrl: insertData.sourceUrl ?? null,
        supplierPrice: insertData.supplierPrice ?? null,
        acquisitionCost: insertData.acquisitionCost ?? null,
        importRawData: insertData.importRawData ?? null,
        importStatus: insertData.importStatus ?? null,
        importErrors: imageList(insertData.importErrors),
        internalNotes: insertData.internalNotes ?? null,
        importedAt: insertData.importedAt ?? null,
        lastCheckedAt: insertData.lastCheckedAt ?? null,
        slug: uniqueSlug(slug, id),
        createdAt,
        updatedAt: createdAt,
      };
      demoWatches.unshift(watch);
      return toAdminWatch(watch);
    },
  );
}

export async function updateWatch(id: number, data: Partial<InsertWatch> & Record<string, unknown>) {
  const payload = normalizeWatchInput(data);
  const updatedAt = now();

  return withDb(
    async (database) => {
      const result = await database
        .update(watches)
        .set({ ...payload, updatedAt })
        .where(eq(watches.id, id))
        .returning();
      return result.length > 0 ? toAdminWatch(result[0]) : undefined;
    },
    () => {
      const index = demoWatches.findIndex((watch) => watch.id === id);
      if (index === -1) return undefined;
      demoWatches[index] = { ...demoWatches[index], ...payload, updatedAt } as Watch;
      return toAdminWatch(demoWatches[index]);
    },
  );
}

export async function archiveWatch(id: number) {
  return updateWatch(id, {
    availability: "hidden",
    visibility: "archived",
    publicationStatus: "archived",
  });
}

export async function duplicateWatch(id: number) {
  const source = await getWatchById(id);
  if (!source) return undefined;

  const copy = {
    brand: source.brand,
    model: `${source.model} Copy`,
    title: source.title ? `${source.title} Copy` : undefined,
    reference: source.reference ? `${source.reference}-copy` : undefined,
    year: source.year ?? undefined,
    condition: source.condition ?? undefined,
    boxPapers: source.boxPapers ?? undefined,
    movement: source.movement ?? undefined,
    caseSize: source.caseSize ?? undefined,
    material: source.material ?? undefined,
    dialColor: source.dialColor ?? undefined,
    braceletMaterial: source.braceletMaterial ?? undefined,
    publicPrice: source.publicPrice ?? undefined,
    currency: source.currency,
    availability: "hidden" as Availability,
    visibility: "private" as Visibility,
    publicationStatus: "draft" as PublicationStatus,
    category: source.category ?? undefined,
    tags: imageList(source.tags),
    featured: false,
    hype: false,
    newArrival: false,
    description: source.description ?? undefined,
    publicImages: imageList(source.publicImages),
    importedFromUrl: source.importedFromUrl,
    supplierName: source.supplierName ?? undefined,
    supplierDomain: source.supplierDomain ?? undefined,
    supplierUrl: source.supplierUrl ?? undefined,
    sourceUrl: source.sourceUrl ?? undefined,
    supplierPrice: source.supplierPrice ?? undefined,
    acquisitionCost: source.acquisitionCost ?? undefined,
    importRawData: source.importRawData ?? undefined,
    importStatus: "duplicated",
    importErrors: [],
    internalNotes: source.internalNotes ?? undefined,
    slug: `${toSlug(source.brand, source.model, source.reference)}-copy-${Date.now()}`,
  };

  return createWatch(copy);
}

export async function getWatchBrands() {
  return withDb(
    async (database) => {
      const result = await database
        .select({ brand: watches.brand })
        .from(watches)
        .where(
          and(
            eq(watches.publicationStatus, "published" as PublicationStatus),
            eq(watches.visibility, "public" as Visibility),
            ne(watches.availability, "hidden" as Availability),
          ),
        );
      const brands = result.map((row) => row.brand);
      return [...new Set(brands)].sort();
    },
    () => [...new Set(demoWatches.filter((watch) => publicFilter(watch)).map((watch) => watch.brand))].sort(),
  );
}

export async function createPurchaseRequest(data: InsertPurchaseRequest & Record<string, unknown>) {
  const payload = normalizeRequestInput(data);

  return withDb(
    async (database) => {
      const result = await database.insert(purchaseRequests).values(payload).returning();
      return toPurchaseDto(result[0]);
    },
    () => {
      const createdAt = now();
      const request: PurchaseRequest = {
        id: nextRequestId(),
        watchId: payload.watchId,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone ?? null,
        customerCountry: payload.customerCountry ?? null,
        message: payload.message ?? null,
        preferredPaymentMethod: payload.preferredPaymentMethod ?? "crypto",
        cryptoCurrency: payload.cryptoCurrency ?? "none",
        walletAddress: payload.walletAddress ?? null,
        transactionHash: payload.transactionHash ?? null,
        paymentProcessor: payload.paymentProcessor ?? null,
        paymentInvoiceId: payload.paymentInvoiceId ?? null,
        paymentCheckoutUrl: payload.paymentCheckoutUrl ?? null,
        paymentStatus: payload.paymentStatus ?? null,
        paymentAmount: payload.paymentAmount ?? null,
        paymentCurrency: payload.paymentCurrency ?? null,
        paymentInvoiceCreatedAt: payload.paymentInvoiceCreatedAt ?? null,
        paymentInvoiceExpiresAt: payload.paymentInvoiceExpiresAt ?? null,
        paymentSettledAt: payload.paymentSettledAt ?? null,
        paymentRawData: payload.paymentRawData ?? {},
        status: payload.status ?? "new",
        adminNotes: payload.adminNotes ?? null,
        createdAt,
        updatedAt: createdAt,
      };
      demoRequests.unshift(request);
      return toPurchaseDto(request);
    },
  );
}

export async function updatePurchaseRequestPayment(id: number, data: PaymentUpdate) {
  const updatedAt = now();
  return withDb(
    async (database) => {
      const result = await database
        .update(purchaseRequests)
        .set({ ...data, updatedAt })
        .where(eq(purchaseRequests.id, id))
        .returning();
      return result[0] ? toPurchaseDto(result[0]) : undefined;
    },
    () => {
      const request = demoRequests.find((item) => item.id === id);
      if (!request) return undefined;
      Object.assign(request, data, { updatedAt });
      return toPurchaseDto(request);
    },
  );
}

export async function updatePurchaseRequestPaymentByInvoiceId(
  invoiceId: string,
  data: PaymentUpdate,
) {
  const updatedAt = now();
  return withDb(
    async (database) => {
      const result = await database
        .update(purchaseRequests)
        .set({ ...data, updatedAt })
        .where(eq(purchaseRequests.paymentInvoiceId, invoiceId))
        .returning();
      return result[0] ? toPurchaseDto(result[0]) : undefined;
    },
    () => {
      const request = demoRequests.find((item) => item.paymentInvoiceId === invoiceId);
      if (!request) return undefined;
      Object.assign(request, data, { updatedAt });
      return toPurchaseDto(request);
    },
  );
}

function joinRequestWatch(request: PurchaseRequest) {
  const watch = demoWatches.find((item) => item.id === request.watchId);
  return {
    request: toPurchaseDto(request),
    watch: watch ? { brand: watch.brand, model: watch.model, slug: watch.slug } : null,
  };
}

export async function getAllPurchaseRequests() {
  return withDb(
    async (database) => {
      const rows = await database
        .select({
          request: purchaseRequests,
          watch: { brand: watches.brand, model: watches.model, slug: watches.slug },
        })
        .from(purchaseRequests)
        .leftJoin(watches, eq(purchaseRequests.watchId, watches.id))
        .orderBy(desc(purchaseRequests.createdAt));

      return rows.map((row) => ({
        request: toPurchaseDto(row.request),
        watch: row.watch,
      }));
    },
    () => demoRequests.map(joinRequestWatch),
  );
}

export async function getPurchaseRequestById(id: number) {
  return withDb(
    async (database) => {
      const result = await database
        .select({
          request: purchaseRequests,
          watch: { brand: watches.brand, model: watches.model, slug: watches.slug },
        })
        .from(purchaseRequests)
        .leftJoin(watches, eq(purchaseRequests.watchId, watches.id))
        .where(eq(purchaseRequests.id, id))
        .limit(1);
      const row = result[0];
      return row ? { request: toPurchaseDto(row.request), watch: row.watch } : undefined;
    },
    () => {
      const request = demoRequests.find((item) => item.id === id);
      return request ? joinRequestWatch(request) : undefined;
    },
  );
}

export async function updatePurchaseRequestStatus(id: number, status: string, adminNotes?: string) {
  const updatedAt = now();
  return withDb(
    async (database) => {
      const result = await database
        .update(purchaseRequests)
        .set({
          status: status as RequestStatus,
          adminNotes: adminNotes ?? undefined,
          updatedAt,
        })
        .where(eq(purchaseRequests.id, id))
        .returning();
      if (!result[0]) return undefined;
      return getPurchaseRequestById(id);
    },
    () => {
      const request = demoRequests.find((item) => item.id === id);
      if (!request) return undefined;
      request.status = status as RequestStatus;
      if (adminNotes !== undefined) request.adminNotes = adminNotes;
      request.updatedAt = updatedAt;
      return joinRequestWatch(request);
    },
  );
}

export async function getDashboardMetrics() {
  const [allWatches, allRequests] = await Promise.all([getAllWatchesAdmin(), getAllPurchaseRequests()]);

  return {
    totalWatches: allWatches.filter((watch) => watch.availability !== "hidden").length,
    availableWatches: allWatches.filter((watch) => watch.availability === "available").length,
    reservedWatches: allWatches.filter((watch) => watch.availability === "reserved").length,
    soldWatches: allWatches.filter((watch) => watch.availability === "sold").length,
    newRequests: allRequests.filter(({ request }) => request.status === "new").length,
    totalRequests: allRequests.length,
  };
}

export async function getSystemHealth() {
  const database = await getDb();
  return {
    database: database ? "connected" : "local-demo-fallback",
    storage: process.env.R2_BUCKET ? "r2-configured" : "local/public-folder",
    email: emailStatus(),
    payments: ENV.btcpayEnabled ? "btcpay-configured" : "btcpay-disabled",
    publicDataSeparation: "enforced",
  };
}

export function privateWatchFieldNames() {
  return [...PRIVATE_WATCH_FIELDS];
}
