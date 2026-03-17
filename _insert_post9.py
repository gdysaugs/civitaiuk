from pathlib import Path


def esc(value: str) -> str:
    return value.replace("'", "''")


title = "体型プロンプト一覧（再編集版）"
body = Path("/home/adama/civitaiuk/_post9_body_reedited.md").read_text(encoding="utf-8")
thumb = "https://ai-freak.com/wp-content/uploads/2023/12/body.jpg"

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
  'image/jpeg',
  'owner',
  0,
  0
);
""".strip() + "\n"

Path("/home/adama/civitaiuk/_insert_post9.sql").write_text(sql, encoding="utf-8")
print("wrote _insert_post9.sql")
