# Local Development Overrides

## Supplier Sync Safety Rules

- Keep supplier sync admin-first. Do not expose supplier names, source URLs, supplier prices, raw payloads, raw snapshots, or supplier image source URLs on public routes.
- Keep `autoPublish` disabled by default. Imported watches should become private drafts unless a supplier is explicitly configured and all review gates pass.
- Do not treat network failures as out-of-stock. Preserve last known price and stock when fetch/extraction fails.
- Do not mark a missing product unavailable until the configured missing-product threshold is reached after successful discovery runs.
- Reject SVG and non-image MIME types for supplier images. Copy approved images to local storage or R2; do not hotlink supplier images in public listings.
- Validate supplier URLs before fetch and after redirects. Block localhost, raw IP URLs, private networks, credentials, custom ports, and paths outside the supplier config.
- Do not enable live/scheduled crawling unless supplier permission, Redis, cron secret, and security gates are configured.
