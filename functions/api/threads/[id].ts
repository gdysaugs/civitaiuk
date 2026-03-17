import { requireAdmin } from "../../_security";
import { json } from "../../_utils";

type Env = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const postId = Number(params.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ error: "Invalid post id." }, 400);
  }

  const post = await env.DB.prepare(
    `SELECT
       t.id,
       t.title,
       t.author_name AS authorName,
       t.created_at AS createdAt,
       t.updated_at AS updatedAt,
       p.body,
       p.media_url AS mediaUrl,
       p.media_mime AS mediaMime,
       p.thumbnail_url AS thumbnailUrl
     FROM threads t
     LEFT JOIN posts p ON p.id = (
       SELECT p1.id
       FROM posts p1
       WHERE p1.thread_id = t.id
         AND p1.is_deleted = 0
       ORDER BY datetime(p1.created_at) ASC, p1.id ASC
       LIMIT 1
     )
     WHERE t.id = ?1
       AND t.is_deleted = 0
       AND p.id IS NOT NULL`
  )
    .bind(postId)
    .first();

  if (!post) return json({ error: "Post not found." }, 404);

  const recommended = await env.DB.prepare(
    `SELECT
       t.id,
       t.title,
       p.media_url AS mediaUrl,
       p.media_mime AS mediaMime,
       p.thumbnail_url AS thumbnailUrl
     FROM threads t
     LEFT JOIN posts p ON p.id = (
       SELECT p1.id
       FROM posts p1
       WHERE p1.thread_id = t.id
         AND p1.is_deleted = 0
       ORDER BY datetime(p1.created_at) ASC, p1.id ASC
       LIMIT 1
     )
     WHERE t.is_deleted = 0
       AND t.id != ?1
       AND p.id IS NOT NULL
     ORDER BY RANDOM()
     LIMIT 6`
  )
    .bind(postId)
    .all();

  return json({ post, recommendations: recommended.results ?? [] });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const postId = Number(params.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ error: "Invalid post id." }, 400);
  }

  const exists = await env.DB.prepare(
    `SELECT id
     FROM threads
     WHERE id = ?1
       AND is_deleted = 0`
  )
    .bind(postId)
    .first<{ id: number }>();

  if (!exists) return json({ error: "Post not found." }, 404);

  await env.DB.prepare(
    `UPDATE threads
     SET is_deleted = 1,
         is_locked = 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  )
    .bind(postId)
    .run();

  await env.DB.prepare(
    `UPDATE posts
     SET is_deleted = 1
     WHERE thread_id = ?1`
  )
    .bind(postId)
    .run();

  return json({ ok: true, id: postId });
};
