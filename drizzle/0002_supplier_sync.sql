--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE supplier_product_availability AS ENUM ('in_stock', 'out_of_stock', 'preorder', 'backorder', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE supplier_product_status AS ENUM ('discovered', 'draft', 'published', 'rejected', 'needs_review', 'unavailable', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE sync_run_type AS ENUM ('discovery', 'product_sync', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE sync_run_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE crawl_queue_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE supplier_image_status AS ENUM ('pending', 'stored', 'failed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE field_provenance_source AS ENUM ('json_ld', 'embedded_data', 'opengraph', 'meta', 'supplier_selector', 'generic_selector', 'ai_normalized', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS product_categories (
  id serial PRIMARY KEY,
  name varchar(128) NOT NULL,
  slug varchar(160) NOT NULL UNIQUE,
  parent_id integer REFERENCES product_categories(id) ON DELETE SET NULL,
  markup_percent numeric(8, 2),
  fixed_fee numeric(14, 2),
  rounding_rule varchar(32) NOT NULL DEFAULT 'nearest_50',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS suppliers (
  id serial PRIMARY KEY,
  private_name text NOT NULL,
  allowed_hostname varchar(255) NOT NULL,
  allowed_path_prefixes jsonb NOT NULL DEFAULT '[]'::jsonb,
  catalogue_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  permission_reference text,
  default_markup_percent numeric(8, 2) NOT NULL DEFAULT 20.00,
  target_currency varchar(3) NOT NULL DEFAULT 'CHF',
  sync_interval_minutes integer NOT NULL DEFAULT 30,
  discovery_interval_minutes integer NOT NULL DEFAULT 1440,
  max_concurrency integer NOT NULL DEFAULT 2,
  requests_per_minute integer NOT NULL DEFAULT 30,
  auto_publish boolean NOT NULL DEFAULT false,
  auto_publish_minimum_confidence numeric(4, 2) NOT NULL DEFAULT 0.90,
  download_images boolean NOT NULL DEFAULT true,
  price_change_review_threshold_percent numeric(8, 2) NOT NULL DEFAULT 25.00,
  missing_product_disable_threshold integer NOT NULL DEFAULT 3,
  last_successful_sync_at timestamptz,
  last_discovery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supplier_products (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  public_product_id integer REFERENCES watches(id) ON DELETE SET NULL,
  destination_category_id integer REFERENCES product_categories(id) ON DELETE SET NULL,
  source_product_id text,
  canonical_url text NOT NULL,
  source_sku text,
  source_brand text,
  source_title text NOT NULL,
  source_description text,
  source_category text,
  source_breadcrumbs jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_type varchar(80),
  gender varchar(16) NOT NULL DEFAULT 'unknown',
  condition varchar(32) NOT NULL DEFAULT 'unknown',
  supplier_price numeric(14, 2),
  supplier_currency varchar(3),
  public_price numeric(14, 2),
  public_currency varchar(3),
  markup_percent_applied numeric(8, 2),
  fixed_fee_applied numeric(14, 2),
  price_calculated_at timestamptz,
  price_review_required boolean NOT NULL DEFAULT false,
  availability supplier_product_availability NOT NULL DEFAULT 'unknown',
  raw_payload jsonb,
  normalized_payload jsonb,
  field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_locks jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash varchar(128),
  extraction_confidence numeric(4, 2) NOT NULL DEFAULT 0.00,
  category_confidence numeric(4, 2) NOT NULL DEFAULT 0.00,
  consecutive_missing_count integer NOT NULL DEFAULT 0,
  consecutive_failure_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_successful_extraction_at timestamptz,
  status supplier_product_status NOT NULL DEFAULT 'discovered',
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supplier_variants (
  id serial PRIMARY KEY,
  supplier_product_id integer NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  source_variant_id text,
  sku text,
  title text,
  size varchar(80),
  color varchar(80),
  material varchar(128),
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  supplier_price numeric(14, 2),
  currency varchar(3),
  availability supplier_product_availability NOT NULL DEFAULT 'unknown',
  image_url text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supplier_images (
  id serial PRIMARY KEY,
  supplier_product_id integer NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  stored_url text,
  storage_key text,
  image_hash varchar(128),
  position integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  status supplier_image_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS category_mappings (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  source_value text NOT NULL,
  source_type varchar(64) NOT NULL,
  destination_category_id integer NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  confidence numeric(4, 2) NOT NULL DEFAULT 1.00,
  manually_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sync_runs (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type sync_run_type NOT NULL,
  status sync_run_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  heartbeat_at timestamptz,
  pages_visited integer NOT NULL DEFAULT 0,
  products_discovered integer NOT NULL DEFAULT 0,
  products_created integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_unchanged integer NOT NULL DEFAULT 0,
  products_rejected integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sync_changes (
  id serial PRIMARY KEY,
  sync_run_id integer NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  supplier_product_id integer REFERENCES supplier_products(id) ON DELETE SET NULL,
  field varchar(128) NOT NULL,
  previous_value jsonb,
  next_value jsonb,
  action varchar(64) NOT NULL,
  source varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS raw_page_snapshots (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  url text NOT NULL,
  status_code integer,
  content_hash varchar(128) NOT NULL,
  extracted_json_ld jsonb,
  extraction_diagnostics jsonb,
  storage_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supplier_crawl_queue (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sync_run_id integer REFERENCES sync_runs(id) ON DELETE CASCADE,
  url text NOT NULL,
  url_type varchar(64) NOT NULL DEFAULT 'unknown',
  status crawl_queue_status NOT NULL DEFAULT 'queued',
  depth integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error text,
  content_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS product_categories_parent_id_idx ON product_categories(parent_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_allowed_hostname_idx ON suppliers(allowed_hostname);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS suppliers_active_idx ON suppliers(active);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_supplier_canonical_idx ON supplier_products(supplier_id, canonical_url);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_products_supplier_id_idx ON supplier_products(supplier_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_products_public_product_id_idx ON supplier_products(public_product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_products_status_idx ON supplier_products(status);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS supplier_variants_product_source_idx ON supplier_variants(supplier_product_id, source_variant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_variants_product_id_idx ON supplier_variants(supplier_product_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS supplier_images_product_source_idx ON supplier_images(supplier_product_id, source_url);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_images_product_id_idx ON supplier_images(supplier_product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_images_hash_idx ON supplier_images(image_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS category_mappings_supplier_source_idx ON category_mappings(supplier_id, source_type, source_value);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_runs_supplier_status_idx ON sync_runs(supplier_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_runs_created_at_idx ON sync_runs(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_changes_sync_run_id_idx ON sync_changes(sync_run_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_changes_supplier_product_id_idx ON sync_changes(supplier_product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS raw_page_snapshots_supplier_url_idx ON raw_page_snapshots(supplier_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS raw_page_snapshots_hash_idx ON raw_page_snapshots(content_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS supplier_crawl_queue_supplier_url_idx ON supplier_crawl_queue(supplier_id, url);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_crawl_queue_supplier_status_idx ON supplier_crawl_queue(supplier_id, status);
