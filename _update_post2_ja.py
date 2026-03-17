# -*- coding: utf-8 -*-
from pathlib import Path

title = 'AI動画のレシピ：成人向けプロンプト大全（和訳付き・再編集版）'
body = Path('_post2_body_with_ja.md').read_text(encoding='utf-8')

def esc(s: str) -> str:
    return s.replace("'", "''")

sql = f"""
UPDATE threads
SET title = '{esc(title)}',
    author_name = 'owner',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 2;

UPDATE posts
SET body = '{esc(body)}',
    author_name = 'owner'
WHERE thread_id = 2
  AND is_deleted = 0;
""".strip() + "\n"

Path('_update_post2_ja.sql').write_text(sql, encoding='utf-8')
print('wrote _update_post2_ja.sql')
