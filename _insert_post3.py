from pathlib import Path

def esc(s: str) -> str:
    return s.replace("'", "''")

title = '\u0041\u0049\u52d5\u753b\u306e\u30ec\u30b7\u30d4\uff1a\u30bb\u30c3\u30af\u30b9\u30fb\u4f53\u4f4d\u30d7\u30ed\u30f3\u30d7\u30c8\u96c6\uff08\u518d\u7de8\u96c6\u7248\uff09'
body = Path('/home/adama/civitaiuk/_post3_body_reedited.md').read_text(encoding='utf-8')
thumb = 'https://today-okazu.com/wp-content/uploads/2024/12/00_eyecatch_sexpmpt.webp'

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
  'image/webp',
  'owner',
  0,
  0
);
""".strip() + "\n"

Path('/home/adama/civitaiuk/_insert_post3.sql').write_text(sql, encoding='utf-8')
print('wrote _insert_post3.sql')
