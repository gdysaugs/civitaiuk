from pathlib import Path


def esc(value: str) -> str:
    return value.replace("'", "''")


thread_id = 12
title = "服装プロンプト集"
thumbnail = "https://ai-freak.com/wp-content/uploads/2023/12/fuku-1.jpg"
body = Path("/home/adama/civitaiuk/_post12_body_reedited.md").read_text(encoding="utf-8")

sql = f"""
UPDATE threads
SET title = '{esc(title)}'
WHERE id = {thread_id};

UPDATE posts
SET body = '{esc(body)}',
    thumbnail_url = '{esc(thumbnail)}',
    media_mime = 'image/jpeg'
WHERE thread_id = {thread_id}
  AND is_deleted = 0;
""".strip() + "\n"

Path("/home/adama/civitaiuk/_update_post12_clothing.sql").write_text(sql, encoding="utf-8")
print("wrote _update_post12_clothing.sql")
