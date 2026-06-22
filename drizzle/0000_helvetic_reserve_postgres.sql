DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE watch_condition AS ENUM ('unworn', 'excellent', 'very_good', 'good', 'fair');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE watch_availability AS ENUM ('available', 'reserved', 'sold', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE watch_visibility AS ENUM ('public', 'private', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE purchase_request_status AS ENUM ('new', 'reviewing', 'confirmed', 'declined', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('crypto', 'bank_transfer', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crypto_currency AS ENUM ('btc', 'eth', 'usdt', 'usdc', 'none', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE image_visibility AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  open_id varchar(128) NOT NULL UNIQUE,
  name text,
  email varchar(320),
  login_method varchar(64),
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_signed_in timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watches (
  id serial PRIMARY KEY,
  brand varchar(128) NOT NULL,
  model varchar(256) NOT NULL,
  reference varchar(128),
  year integer,
  condition watch_condition DEFAULT 'excellent',
  box_papers varchar(128),
  movement varchar(128),
  case_size varchar(64),
  material varchar(128),
  public_price numeric(14, 2),
  currency varchar(8) NOT NULL DEFAULT 'CHF',
  availability watch_availability NOT NULL DEFAULT 'available',
  visibility watch_visibility NOT NULL DEFAULT 'public',
  featured boolean NOT NULL DEFAULT false,
  description text,
  public_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  supplier_name text,
  supplier_url text,
  source_url text,
  supplier_price numeric(14, 2),
  acquisition_cost numeric(14, 2),
  internal_notes text,
  slug varchar(256) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watches_brand_idx ON watches (brand);
CREATE INDEX IF NOT EXISTS watches_availability_idx ON watches (availability);
CREATE INDEX IF NOT EXISTS watches_visibility_idx ON watches (visibility);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id serial PRIMARY KEY,
  watch_id integer NOT NULL REFERENCES watches(id) ON DELETE RESTRICT,
  customer_name varchar(256) NOT NULL,
  customer_email varchar(320) NOT NULL,
  customer_phone varchar(64),
  customer_country varchar(128),
  message text,
  preferred_payment_method payment_method NOT NULL DEFAULT 'crypto',
  crypto_currency crypto_currency DEFAULT 'none',
  wallet_address text,
  transaction_hash text,
  status purchase_request_status NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_requests_watch_id_idx ON purchase_requests (watch_id);
CREATE INDEX IF NOT EXISTS purchase_requests_status_idx ON purchase_requests (status);
CREATE INDEX IF NOT EXISTS purchase_requests_customer_email_idx ON purchase_requests (customer_email);

CREATE TABLE IF NOT EXISTS uploaded_images (
  id serial PRIMARY KEY,
  watch_id integer REFERENCES watches(id) ON DELETE SET NULL,
  storage_key text NOT NULL,
  public_url text NOT NULL,
  original_filename text,
  content_type varchar(128),
  size_bytes integer,
  visibility image_visibility NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uploaded_images_watch_id_idx ON uploaded_images (watch_id);
