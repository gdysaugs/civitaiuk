ALTER TABLE threads ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1));
ALTER TABLE threads ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));

ALTER TABLE posts ADD COLUMN media_mime TEXT;
ALTER TABLE posts ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));

ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected'));
ALTER TABLE reports ADD COLUMN resolution_action TEXT;
ALTER TABLE reports ADD COLUMN resolution_note TEXT;
ALTER TABLE reports ADD COLUMN resolved_by TEXT;
ALTER TABLE reports ADD COLUMN resolved_at TEXT;

CREATE INDEX IF NOT EXISTS idx_threads_visible_updated ON threads(is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visible_thread_created ON posts(thread_id, is_deleted, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
