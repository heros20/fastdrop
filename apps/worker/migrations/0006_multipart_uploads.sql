ALTER TABLE files
ADD COLUMN multipart_upload_id TEXT;

ALTER TABLE files
ADD COLUMN upload_started_at TEXT;

CREATE TABLE upload_parts (
  file_id TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  PRIMARY KEY (file_id, part_number),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX IF NOT EXISTS idx_upload_parts_file_id
ON upload_parts (file_id);
