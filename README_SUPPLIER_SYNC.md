# Supplier Catalogue Import & Sync

This is the admin-first supplier sync system for Helvetic Reserve.

## What It Does

- Stores supplier configuration in PostgreSQL.
- Discovers product URLs from catalogue pages, robots.txt, and sitemaps.
- Extracts Product/ProductGroup JSON-LD first, then generic HTML, then Playwright for JS-only pages.
- Copies supplier images into local uploads or R2 instead of hotlinking.
- Stores source URL, supplier price, raw payloads, diagnostics, and source images as admin-only data.
- Creates private watch drafts for imported watch products.
- Keeps non-watch products in admin for categorization and review.
- Uses BullMQ + Redis for scheduled jobs when enabled; manual admin sync runs inline without Redis.

## Environment

```env
REDIS_URL=redis://127.0.0.1:6379
SYNC_WORKER_ENABLED=0
SYNC_CRON_SECRET=
CATALOG_SYNC_ENABLED=0
RAW_SNAPSHOT_RETENTION_DAYS=30
AI_NORMALIZATION_ENABLED=0
AI_NORMALIZATION_MODEL=gpt-5.5
PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT=25
MISSING_PRODUCT_DISABLE_THRESHOLD=3
```

`REDIS_URL` is required only for scheduled BullMQ jobs. Local manual sync from `/admin/suppliers` works without Redis.

## Local Redis

```powershell
docker run --name helvetic-reserve-redis -p 6379:6379 -d redis:7
```

Then set:

```powershell
$env:REDIS_URL="redis://127.0.0.1:6379"
$env:CATALOG_SYNC_ENABLED="1"
$env:SYNC_WORKER_ENABLED="1"
corepack pnpm worker:sync
```

## Admin Flow

1. Open `/admin/suppliers`.
2. Create a supplier with private name, catalogue URL, allowed hostname/path prefixes, markup, currency, and permission reference.
3. Run **Discovery** to discover product URLs and import drafts.
4. Review products, diagnostics, source URL, price/stock, variants, and image status.
5. Correct a category in the product table; this stores a `CategoryMapping`.
6. Use **Watch draft** for watch products if a private draft was not created automatically.
7. Publish only through the existing watch editor after review.

## Safety Rules

- `autoPublish` defaults to false for every supplier.
- Public routes never read `supplier_products`, `supplier_images`, supplier source URLs, supplier prices, raw payloads, or private supplier names.
- Unknown stock never becomes public in-stock.
- Network errors preserve the last good stock/price data.
- Missing products require repeated successful discovery runs before being marked unavailable.
- Price changes above `PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT` are held for admin review.
- SVG images are rejected.
- Images must pass MIME checks, size checks, same-supplier URL scope, DNS checks, and hash/dedupe.
- Playwright is fallback only, not the default extraction path.
- AI normalization is optional and must never normalize price, stock, SKU, reference, URL, variants, or images.

## AI Image Enhancement

Supplier image copying stays original-first. If a copied product image looks bad, open the related watch draft in `/admin/watches/:id/edit` and use the AI image enhancement panel.

The enhanced image is a separate review copy. It does not replace the watch image until an admin clicks **Use enhanced image**.

## Migrations

Run either:

```powershell
corepack pnpm db:sql
```

or:

```powershell
corepack pnpm db:push
corepack pnpm seed
```

The supplier sync tables are:

- `suppliers`
- `supplier_products`
- `supplier_variants`
- `supplier_images`
- `category_mappings`
- `sync_runs`
- `sync_changes`
- `raw_page_snapshots`
- `supplier_crawl_queue`
- `product_categories`

## Verification

```powershell
corepack pnpm check
corepack pnpm test
corepack pnpm build
```
