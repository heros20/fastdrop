CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT,
  password_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (transfer_id) REFERENCES transfers(id)
);