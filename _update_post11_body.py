from pathlib import Path


def esc(value: str) -> str:
    return value.replace("'", "''")


thread_id = 11
body = Path("/home/adama/civitaiuk/_post11_body_reedited.md").read_text(encoding="utf-8")

sql = f"""
UPDATE posts
SET body = '{esc(body)}'
WHERE thread_id = {thread_id}
  AND is_deleted = 0;
""".strip() + "\n"

Path("/home/adama/civitaiuk/_update_post11_body.sql").write_text(sql, encoding="utf-8")
print("wrote _update_post11_body.sql")
