from pathlib import Path


def esc(value: str) -> str:
    return value.replace("'", "''")


title = "カメラアングル・構図プロンプト集（再編集版）"
body = Path("/home/adama/civitaiuk/_post6_body_reedited.md").read_text(encoding="utf-8")
thumb_new = "/post-6-thumb.webp"
thumb_post5 = "/post-5-thumb.webp"

sql = f"""
UPDATE posts
SET thumbnail_url = '{esc(thumb_post5)}',
    media_mime = 'image/webp'
WHERE thread_id = 5
  AND is_deleted = 0;

INSERT INTO threads (title, author_name, media_type, nsfw, is_locked, is_deleted)
VALUES ('{esc(title)}', 'owner', 'image', 0, 1, 0);

INSERT INTO posts (
  thread_id,
  body,
  media_url,
  thumbnail_url,
  media_mime,
  author_name,
  nsfw,
  is_deleted
) VALUES (
  last_insert_rowid(),
  '{esc(body)}',
  NULL,
  '{esc(thumb_new)}',
  'image/webp',
  'owner',
  0,
  0
);
""".strip() + "\n"

Path("/home/adama/civitaiuk/_insert_post6.sql").write_text(sql, encoding="utf-8")
print("wrote _insert_post6.sql")
