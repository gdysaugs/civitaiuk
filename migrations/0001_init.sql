PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'anonymous',
  model_name TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'mixed')),
  nsfw INTEGER NOT NULL DEFAULT 0 CHECK (nsfw IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  prompt TEXT,
  workflow_json TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  seed INTEGER,
  sampler TEXT,
  steps INTEGER,
  cfg_scale REAL,
  width INTEGER,
  height INTEGER,
  author_name TEXT NOT NULL DEFAULT 'anonymous',
  nsfw INTEGER NOT NULL DEFAULT 0 CHECK (nsfw IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER,
  post_id INTEGER,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_thread_created ON posts(thread_id, created_at ASC);

CREATE TRIGGER IF NOT EXISTS trg_threads_touch_after_post
AFTER INSERT ON posts
BEGIN
  UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.thread_id;
END;