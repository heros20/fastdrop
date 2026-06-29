ALTER TABLE transfers
ADD COLUMN delete_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_transfers_slug_delete_token_hash
ON transfers (slug, delete_token_hash);
