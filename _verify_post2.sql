SELECT id,title,updated_at FROM threads WHERE id=2;
SELECT length(body) AS len, instr(body,'参考元') AS has_ref, instr(body,'sex：セックス') AS has_ja FROM posts WHERE thread_id=2 AND is_deleted=0 LIMIT 1;
