-- Switch to blog mode: hide legacy board data.
UPDATE posts
SET is_deleted = 1
WHERE is_deleted = 0;

UPDATE threads
SET is_deleted = 1,
    is_locked = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE is_deleted = 0;

DELETE FROM reports;
DELETE FROM poster_sanctions;
