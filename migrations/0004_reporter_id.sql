ALTER TABLE reports ADD COLUMN reporter_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_post_created ON reports(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_post_reporter_created ON reports(post_id, reporter_id, created_at DESC);

