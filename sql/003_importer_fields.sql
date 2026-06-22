DO $$ BEGIN
  CREATE TYPE watch_publication_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE watches ADD COLUMN IF NOT EXISTS title varchar(320);
ALTER TABLE watches ADD COLUMN IF NOT EXISTS dial_color varchar(128);
ALTER TABLE watches ADD COLUMN IF NOT EXISTS bracelet_material varchar(128);
ALTER TABLE watches ADD COLUMN IF NOT EXISTS publication_status watch_publication_status NOT NULL DEFAULT 'published';
ALTER TABLE watches ADD COLUMN IF NOT EXISTS category varchar(128);
ALTER TABLE watches ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS hype boolean NOT NULL DEFAULT false;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS new_arrival boolean NOT NULL DEFAULT false;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS imported_from_url boolean NOT NULL DEFAULT false;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS supplier_domain text;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS import_raw_data jsonb;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS import_status varchar(64);
ALTER TABLE watches ADD COLUMN IF NOT EXISTS import_errors jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS imported_at timestamptz;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

UPDATE watches
SET
  publication_status = 'published',
  title = COALESCE(title, trim(concat_ws(' ', brand, model, reference))),
  category = COALESCE(category, brand),
  tags = CASE
    WHEN tags IS NULL OR tags = '[]'::jsonb THEN jsonb_build_array(brand)
    ELSE tags
  END
WHERE publication_status IS NULL OR title IS NULL OR category IS NULL;

CREATE INDEX IF NOT EXISTS watches_publication_status_idx ON watches (publication_status);
CREATE INDEX IF NOT EXISTS watches_category_idx ON watches (category);
