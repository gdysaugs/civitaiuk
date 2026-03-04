CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
ON reports(reporter_id, created_at DESC);
