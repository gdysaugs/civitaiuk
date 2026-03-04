CREATE TABLE IF NOT EXISTS poster_sanctions (
  poster_id TEXT PRIMARY KEY,
  write_block_until TEXT,
  require_turnstile INTEGER NOT NULL DEFAULT 0 CHECK (require_turnstile IN (0, 1)),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poster_sanctions_write_block_until
ON poster_sanctions(write_block_until DESC);
