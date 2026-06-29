CREATE INDEX IF NOT EXISTS idx_transfers_expires_at
ON transfers (expires_at);

CREATE INDEX IF NOT EXISTS idx_files_transfer_id
ON files (transfer_id);
