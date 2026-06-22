# Helvetic Reserve

Request-based luxury watch catalogue for `helvetic-reserve.com`.

The public site lets customers browse watches and submit purchase requests. The admin dashboard manages watches, private supplier/source data, purchase requests, request status, notes, storage, and health checks. Public watch routes intentionally exclude supplier-private fields.

## External Configuration Needed

Configure these in `.env.local` for local development and in your hosting provider's secret manager for production. Do not paste secrets into chat and do not commit them.

| Variable | Required | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | Required in production | PostgreSQL provider dashboard. Use a PostgreSQL connection string. |
| `DEV_DATABASE_URL` | Optional locally | Local Docker PostgreSQL connection string. Defaults to `postgres://postgres:postgres@127.0.0.1:5432/helvetic_reserve`. |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | Cloudflare dashboard account ID, only needed if provisioning Hyperdrive with API tooling. |
| `CLOUDFLARE_API_TOKEN` | Optional secret | Cloudflare API token, only needed if provisioning Hyperdrive with API tooling. Store securely, never in git. |
| `HYPERDRIVE_CONFIG_ID` | Optional | Cloudflare Hyperdrive config ID after Hyperdrive is created. Hyperdrive points to an existing PostgreSQL origin. |
| `JWT_SECRET` | Required in production | Generate a long random secret locally, for example with `openssl rand -base64 32`. |
| `OWNER_OPEN_ID` | Required in production | Existing Manus OAuth/admin identity provider. This marks the owner as admin. |
| `OAUTH_SERVER_URL` | Required in production | Existing OAuth provider/admin auth configuration. |
| `BUILT_IN_FORGE_API_URL` | Required for existing OAuth SDK integrations | Existing platform/OAuth service configuration. |
| `BUILT_IN_FORGE_API_KEY` | Required for existing OAuth SDK integrations | Existing platform/OAuth service secret configuration. |
| `LOCAL_ADMIN_BYPASS` | Optional local only | Set to `1` only on your machine to preview `/admin` without OAuth. Never enable in production. |
| `PUBLIC_CONTACT_EMAIL` | Optional | Use `contact@helvetic-reserve.com`. |
| `R2_ENDPOINT` | Required for production R2 media | Cloudflare R2 bucket S3 API endpoint. |
| `R2_BUCKET` | Required for production R2 media | Cloudflare R2 bucket name. |
| `R2_ACCESS_KEY_ID` | Required for production R2 media | Cloudflare R2 API token / S3 access key. Rotate any secret that was pasted into chat. |
| `R2_SECRET_ACCESS_KEY` | Required for production R2 media | Cloudflare R2 S3 secret access key. Rotate any secret that was pasted into chat. |
| `R2_PUBLIC_BASE_URL` | Recommended for production media | Public R2 custom domain or public bucket URL used for watch images. |
| `OPENAI_API_KEY` | Optional secret | OpenAI API project key for AI-assisted importer extraction. Store only in `.env.local` or production secrets. Rotate any key pasted into chat. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-5.5`. Used only when `OPENAI_API_KEY` is configured. |
| `OPENAI_IMAGE_MODEL` | Optional | Defaults to `gpt-image-2`. Reserved for image-generation/editing features; do not use generated images as real product photos. |
| `REDIS_URL` | Optional locally, required for scheduled supplier sync | Local Docker Redis or managed Redis URL. Manual admin sync can run inline without Redis. |
| `SYNC_WORKER_ENABLED` | Optional | Set `1` only in a worker process that should process BullMQ supplier sync jobs. |
| `SYNC_CRON_SECRET` | Required if using cron endpoint | Long random secret for `/api/supplier-sync/cron`. Store in secrets, not git. |
| `CATALOG_SYNC_ENABLED` | Optional | Set `1` to queue scheduled supplier sync jobs. Manual admin sync still works without it. |
| `RAW_SNAPSHOT_RETENTION_DAYS` | Optional | Defaults to `30`. Retention target for raw page snapshots. |
| `AI_NORMALIZATION_ENABLED` | Optional | Set `1` to allow AI-assisted category/text normalization. It must not normalize price, stock, SKU, URLs, variants, or images. |
| `AI_NORMALIZATION_MODEL` | Optional | Defaults to `OPENAI_MODEL` or `gpt-5.5`. |
| `PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT` | Optional | Defaults to `25`. Supplier price changes above this hold public price updates for review. |
| `MISSING_PRODUCT_DISABLE_THRESHOLD` | Optional | Defaults to `3`. Successful discoveries required before a missing product is marked unavailable. |
| `CLOUDFLARE_EMAIL_ROUTING_ADDRESS` | Optional | Cloudflare Email Routing destination for inbound `contact@helvetic-reserve.com` mail. |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Optional secret | Cloudflare API token with Email Sending permission, used by the Node/Express backend to send purchase request notifications. |
| `CLOUDFLARE_EMAIL_FROM` | Optional | Verified sender address, default `contact@helvetic-reserve.com`. |
| `CLOUDFLARE_EMAIL_TO` | Optional | Admin notification recipient, default `contact@helvetic-reserve.com`. |
| `CLOUDFLARE_EMAIL_SEND_CUSTOMER_CONFIRMATION` | Optional | Set `1` to email customers after a request. Requires Cloudflare Email Sending entitlement for arbitrary recipients. Defaults to admin-only notifications. |

The `helvetic-reserve-media` R2 bucket is in the EU jurisdiction, so its S3 endpoint must include `.eu.`:

```env
R2_ENDPOINT=https://<account_id>.eu.r2.cloudflarestorage.com
R2_BUCKET=helvetic-reserve-media
```

Default-jurisdiction buckets use `https://<account_id>.r2.cloudflarestorage.com`, but that endpoint cannot access EU-jurisdiction buckets.

## Local Setup

Install dependencies:

```powershell
corepack pnpm install
```

Optional local PostgreSQL with Docker:

```powershell
docker run --name helvetic-reserve-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=helvetic_reserve `
  -p 5432:5432 `
  -d postgres:16
```

Create `.env.local` from `.env.example`. For local admin preview:

```env
LOCAL_ADMIN_BYPASS=1
DEV_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/helvetic_reserve
```

Run migrations and seed when PostgreSQL is available:

```powershell
corepack pnpm db:push
corepack pnpm seed
```

Or apply the raw SQL setup directly:

```powershell
corepack pnpm db:sql
```

Raw SQL files live in `sql/`:

- `sql/001_init.sql` creates enums, tables, indexes, and constraints.
- `sql/002_seed_demo.sql` inserts demo watches with admin-only private supplier data.
- `sql/003_importer_fields.sql` adds importer, category, filter, and draft/publish fields to existing databases.
- `sql/004_supplier_sync.sql` adds supplier sync, categories, variants, images, raw snapshots, sync runs, changes, and crawl queue tables.

If PostgreSQL is not running, the development server falls back to built-in demo watches so the public site and admin UI still load on localhost.

Run the app on localhost:

```powershell
$env:NODE_ENV="development"
$env:PORT="3000"
$env:LOCAL_ADMIN_BYPASS="1"
corepack pnpm exec tsx watch server/_core/index.ts
```

Open `http://127.0.0.1:3000`.

## Cloudflare Hyperdrive

Hyperdrive accelerates and pools connections to an existing PostgreSQL or MySQL database from Cloudflare Workers. It does not create the database or run SQL by itself. Cloudflare's current Hyperdrive docs describe it as a connection layer for existing databases and show Workers using `env.HYPERDRIVE.connectionString`.

Use this order:

1. Create a real PostgreSQL database with a provider such as Neon, Supabase, Xata, CockroachDB, AWS RDS, Google Cloud SQL, Azure, or another PostgreSQL-compatible host.
2. Put that provider connection string in `DATABASE_URL`.
3. Run `corepack pnpm db:sql` or `corepack pnpm db:push && corepack pnpm seed`.
4. Create the Hyperdrive config in Cloudflare using the same PostgreSQL origin host, database, user, and password.
5. Keep the Cloudflare API token and database password in a secure shell/session or provider secret manager. Do not commit them.

For this Express/Node app, `DATABASE_URL` is still the runtime database connection. If the app is later moved to Cloudflare Workers, the database layer should use the Hyperdrive binding connection string from the Worker environment.

## Data Separation

Public watch responses include customer-safe fields such as brand, model, title, reference, condition, public price, currency, availability, description, specs, category, tags, and public images.

Public catalogue/product routes only return watches that are all three:

- `publicationStatus = published`
- `visibility = public`
- `availability != hidden`

Public routes must never expose:

- `supplierName`
- `supplierDomain`
- `supplierUrl`
- `sourceUrl`
- `supplierPrice`
- `acquisitionCost`
- `importRawData`
- `importStatus`
- `importErrors`
- `internalNotes`
- `importedFromUrl`
- `importedAt`
- `lastCheckedAt`
- private source aliases or private supplier images

Admin routes may expose those fields after admin authorization. Tests in `server/public-private-separation.test.ts` and `server/importer.test.ts` verify that public responses do not leak private supplier/import data and that imported drafts do not appear publicly.

## Admin URL Importer

Open `/admin/import` to create a draft watch from a retailer URL. The importer is admin-only and never publishes automatically.

Current allowed supplier domains:

- `timeworld.ch`
- `bucherer.com`
- `watchfinder.ch`
- `tawatch.ch`
- `emeraude.ch`

Import flow:

1. Admin enters a product URL, optional pasted supplier text, and optional image files.
2. Backend validates the URL against the allowlist and rejects localhost, private IPs, raw IP URLs, custom ports, credentials, non-HTTP URLs, and redirects to other domains.
3. Backend fetches HTML server-side with a timeout and size cap.
4. Parser tries JSON-LD Product data, OpenGraph/meta tags, common selectors, and heuristic text extraction.
5. Images are downloaded server-side and copied to local uploads in development or Cloudflare R2 when `R2_*` variables exist.
6. The watch is saved as `publicationStatus=draft` and `visibility=private`.
7. Admin reviews `/admin/watches/:id/edit`, corrects fields/images, then manually sets it public.

The public catalogue uses copied image URLs only. If `R2_PUBLIC_BASE_URL` is missing while R2 is configured, generated R2 URLs may be signed/temporary; configure a public R2 custom domain before publishing imported image-heavy listings.

If `OPENAI_API_KEY` is configured, the importer also sends a compact, sanitized page snapshot to OpenAI's Responses API and uses structured JSON output to fill missing watch fields. AI extraction is an enhancer only: imports still create private drafts, all fields must be reviewed before publishing, and the importer continues to work without OpenAI.

`OPENAI_IMAGE_MODEL` is configured separately for future brand/marketing image generation. Real catalogue listings should use copied supplier-approved photos or manual uploads, not generated watch photos.

## Admin AI Image Enhancement

The watch editor includes an admin-only **AI image enhancement** panel for images already attached to a watch.

Enhancement rules:

- The original image remains saved and unchanged.
- Only an admin can request enhancement.
- The backend sends only the selected watch image to OpenAI's Images edit endpoint.
- The prompt is limited to denoise, sharpen, exposure/white-balance correction, artifact cleanup, and gentle upscaling.
- The prompt explicitly forbids changing dial text, logos, case shape, bracelet, colors, scratches, patina, or condition.
- The enhanced image is stored separately in local uploads or R2.
- The enhanced image is not public unless an admin clicks **Use enhanced image**.
- SVG and unsupported formats are rejected.

Required configuration:

```env
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
```

Supplier parser files live in `server/importer/supplierParsers/`. Add supplier-specific selectors by editing the matching parser and keeping `parseGenericHtml` as fallback. Shared parsing helpers live in:

- `server/importer/genericJsonLdParser.ts`
- `server/importer/genericMetaParser.ts`
- `server/importer/heuristicParser.ts`
- `server/importer/normalizer.ts`

Do not enable scheduled/live supplier scraping unless the documented legal/security gates are complete. The current importer is admin-triggered and draft-only.

## Supplier Catalogue Sync

Open `/admin/suppliers` to configure supplier records, run discovery, sync known products, inspect diagnostics, correct categories, retry failed products, and create private watch drafts.

Supplier sync uses PostgreSQL and can use BullMQ + Redis for scheduled jobs:

```powershell
docker run --name helvetic-reserve-redis -p 6379:6379 -d redis:7
$env:REDIS_URL="redis://127.0.0.1:6379"
$env:CATALOG_SYNC_ENABLED="1"
$env:SYNC_WORKER_ENABLED="1"
corepack pnpm worker:sync
```

Manual discovery/sync from the admin page runs inline when Redis is not configured, which keeps localhost usable. Scheduled jobs require `REDIS_URL`, `CATALOG_SYNC_ENABLED=1`, and a worker process.

The public storefront remains watch-first. Supplier products that are not watches are imported, categorized, and reviewed in admin only. Watch imports create private drafts unless `autoPublish` is explicitly enabled for a supplier and all review gates pass. `autoPublish` defaults to false.

See `README_SUPPLIER_SYNC.md` for architecture, safety rules, and worker/cron details.

## Catalogue Filters

The public catalogue supports search and filters for brand, status/availability, category, condition, currency, price range, year range, material, movement, dial color, bracelet material, box/papers, featured, hype, and new arrivals. Sorting supports newest, price low/high, brand A-Z, and featured first.

## Cloudflare Email Service

This app uses Cloudflare Email Service directly, not Resend.

Cloudflare setup:

1. In Cloudflare, make sure `helvetic-reserve.com` uses Cloudflare DNS.
2. Go to **Compute > Email Service > Email Sending**.
3. Select **Onboard Domain** for `helvetic-reserve.com`.
4. Let Cloudflare add the Email Sending DNS records for the `cf-bounce` subdomain, SPF, DKIM, and DMARC.
5. Create an API token with **Email Sending: Edit** permission.
6. Store that token as `CLOUDFLARE_EMAIL_API_TOKEN` in `.env.local` and production secrets.

The Express backend sends purchase request notifications through Cloudflare's REST endpoint:

```text
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send
```

By default, the app sends only an admin notification to `CLOUDFLARE_EMAIL_TO` when a customer submits a purchase request. Set `CLOUDFLARE_EMAIL_SEND_CUSTOMER_CONFIRMATION=1` only after your Cloudflare account is entitled to send to arbitrary recipients. Cloudflare Email Routing remains useful for inbound `contact@helvetic-reserve.com`.

## Customer Flow

The site is request-based and has no instant checkout. Customers submit a purchase request. Helvetic Reserve manually confirms availability, final price, KYC/compliance needs, payment instructions, shipping, taxes, and delivery before any sale can proceed.

The MVP supports crypto payment review manually. No wallet address, transaction hash, or payment instruction is valid until manually confirmed by Helvetic Reserve.

## Legal Pages

Draft Terms and Privacy pages are included at:

- `/terms`
- `/privacy`

They are operational drafts based on the current business rules and need legal review before production launch.

## Checks

```powershell
corepack pnpm check
corepack pnpm test
corepack pnpm build
```
