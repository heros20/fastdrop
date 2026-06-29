ALTER TABLE files
ADD COLUMN uploaded_at TEXT;

ALTER TABLE files
ADD COLUMN upload_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_files_upload_status
ON files (upload_status);
