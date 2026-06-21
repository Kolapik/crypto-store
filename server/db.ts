import { and, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertWatch, InsertPurchaseRequest, purchaseRequests, users, watches } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Watches ──────────────────────────────────────────────────────────────

export async function getPublicWatches(filters?: { brand?: string; status?: string; sort?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [ne(watches.status, 'hidden')];
  if (filters?.brand) conditions.push(eq(watches.brand, filters.brand));
  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(watches.status, filters.status as any));
  }
  return db.select().from(watches).where(and(...conditions)).orderBy(desc(watches.createdAt));
}

export async function getWatchBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(watches).where(eq(watches.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getWatchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(watches).where(eq(watches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllWatchesAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watches).orderBy(desc(watches.createdAt));
}

export async function createWatch(data: InsertWatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(watches).values(data);
  const result = await db.select().from(watches).where(eq(watches.slug, data.slug)).limit(1);
  return result[0];
}

export async function updateWatch(id: number, data: Partial<InsertWatch>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(watches).set({ ...data, updatedAt: new Date() }).where(eq(watches.id, id));
  return getWatchById(id);
}

export async function archiveWatch(id: number) {
  return updateWatch(id, { status: 'hidden' });
}

export async function getWatchBrands() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ brand: watches.brand }).from(watches).where(ne(watches.status, 'hidden'));
  const brands = result.map(r => r.brand);
  return brands.filter((b, i) => brands.indexOf(b) === i).sort();
}

// ─── Purchase Requests ─────────────────────────────────────────────────────

export async function createPurchaseRequest(data: InsertPurchaseRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(purchaseRequests).values(data);
  const result = await db.select().from(purchaseRequests)
    .where(and(eq(purchaseRequests.watchId, data.watchId), eq(purchaseRequests.customerEmail, data.customerEmail)))
    .orderBy(desc(purchaseRequests.createdAt)).limit(1);
  return result[0];
}

export async function getAllPurchaseRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    request: purchaseRequests,
    watch: { brand: watches.brand, model: watches.model, slug: watches.slug },
  })
    .from(purchaseRequests)
    .leftJoin(watches, eq(purchaseRequests.watchId, watches.id))
    .orderBy(desc(purchaseRequests.createdAt));
}

export async function getPurchaseRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    request: purchaseRequests,
    watch: { brand: watches.brand, model: watches.model, slug: watches.slug },
  })
    .from(purchaseRequests)
    .leftJoin(watches, eq(purchaseRequests.watchId, watches.id))
    .where(eq(purchaseRequests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePurchaseRequestStatus(id: number, status: string, adminNotes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  await db.update(purchaseRequests).set(updateData as any).where(eq(purchaseRequests.id, id));
  return getPurchaseRequestById(id);
}

export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return { totalWatches: 0, availableWatches: 0, reservedWatches: 0, newRequests: 0, totalRequests: 0 };
  const [allWatches, allRequests] = await Promise.all([
    db.select().from(watches),
    db.select().from(purchaseRequests),
  ]);
  return {
    totalWatches: allWatches.filter(w => w.status !== 'hidden').length,
    availableWatches: allWatches.filter(w => w.status === 'available').length,
    reservedWatches: allWatches.filter(w => w.status === 'reserved').length,
    soldWatches: allWatches.filter(w => w.status === 'sold').length,
    newRequests: allRequests.filter(r => r.status === 'new').length,
    totalRequests: allRequests.length,
  };
}
