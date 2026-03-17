ALTER TABLE posts ADD COLUMN poster_id TEXT;
ALTER TABLE posts ADD COLUMN delete_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_visible_thread_created_id
ON posts(thread_id, is_deleted, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_posts_delete_token_hash
ON posts(id, delete_token_hash);
