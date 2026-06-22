DO $$ BEGIN
  CREATE TYPE image_enhancement_status AS ENUM ('processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE image_enhancement_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS image_enhancements (
  id serial PRIMARY KEY,
  watch_id integer NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  original_image_url text NOT NULL,
  enhanced_image_url text,
  storage_key text,
  model varchar(128) NOT NULL,
  prompt text NOT NULL,
  status image_enhancement_status NOT NULL DEFAULT 'processing',
  review_status image_enhancement_review_status NOT NULL DEFAULT 'pending',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_enhancements_watch_id_idx ON image_enhancements(watch_id);
CREATE INDEX IF NOT EXISTS image_enhancements_status_idx ON image_enhancements(status);
