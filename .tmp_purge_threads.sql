UPDATE posts SET is_deleted = 1 WHERE is_deleted = 0;
UPDATE threads SET is_deleted = 1, is_locked = 1 WHERE is_deleted = 0;
