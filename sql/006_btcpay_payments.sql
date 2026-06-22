ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'xmr';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'ltc';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'doge';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'dash';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'sol';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'bnb';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'trx';
ALTER TYPE crypto_currency ADD VALUE IF NOT EXISTS 'matic';

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_processor varchar(32);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_invoice_id text;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_checkout_url text;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_status varchar(64);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_amount numeric(14, 2);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_currency varchar(8);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_invoice_created_at timestamptz;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_invoice_expires_at timestamptz;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_settled_at timestamptz;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS payment_raw_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS purchase_requests_payment_invoice_id_idx ON purchase_requests (payment_invoice_id);
