from pathlib import Path


def esc(value: str) -> str:
    return value.replace("'", "''")


title = "NSFWフェチ表現プロンプト集（再編集版）"
body = Path("/home/adama/civitaiuk/_post7_body_reedited.md").read_text(encoding="utf-8")
thumb = "/post-7-thumb.avif"

sql = f"""
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
  '{esc(thumb)}',
  'image/avif',
  'owner',
  0,
  0
);
""".strip() + "\n"

Path("/home/adama/civitaiuk/_insert_post7.sql").write_text(sql, encoding="utf-8")
print("wrote _insert_post7.sql")
