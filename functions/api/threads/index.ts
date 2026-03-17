import { cleanMediaKey, resolveCommittedMedia } from "../../_media";
import { requireAdmin } from "../../_security";
import {
  cleanLongText,
  cleanText,
  cleanUrl,
  detectMediaKind,
  json,
  parseLimit,
  parseOptionalInt,
  readJson
} from "../../_utils";

type Env = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  MEDIA?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
};

type CreatePostPayload = {
  title?: string;
  body?: string;
  authorName?: string;
  mediaUrl?: string;
  mediaKey?: string;
  mediaMime?: string;
  thumbnailUrl?: string;
};

const DEFAULT_AUTHOR_NAME = "admin";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"), 12, 1, 100);
  const pageCandidate = parseOptionalInt(url.searchParams.get("page"));
  const page = pageCandidate && pageCandidate > 0 ? pageCandidate : 1;
  const offset = (page - 1) * limit;

  const { results } = await env.DB.prepare(
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
     WHERE t.is_deleted = 0
       AND p.id IS NOT NULL
     ORDER BY datetime(t.created_at) DESC, t.id DESC
     LIMIT ?1
     OFFSET ?2`
  )
    .bind(limit, offset)
    .all();

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM threads t
     WHERE t.is_deleted = 0
       AND EXISTS (
         SELECT 1
         FROM posts p
         WHERE p.thread_id = t.id
           AND p.is_deleted = 0
       )`
  ).first<{ total: number }>();

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return json({
    posts: results,
    page,
    limit,
    total,
    totalPages
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const payload = await readJson<CreatePostPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const title = cleanText(payload.title, 120);
  const body = cleanLongText(payload.body, 20000);
  const authorName = cleanText(payload.authorName, 60) ?? DEFAULT_AUTHOR_NAME;

  const mediaUrl = cleanUrl(payload.mediaUrl, 2000);
  const mediaKey = cleanMediaKey(payload.mediaKey);
  const mediaMime = cleanText(payload.mediaMime, 120);
  const thumbnailUrl = cleanUrl(payload.thumbnailUrl, 2000);

  if (!title || title.length < 3) {
    return json({ error: "Title must be at least 3 chars." }, 400);
  }
  if (!body && !mediaUrl && !mediaKey) {
    return json({ error: "Body or media is required." }, 400);
  }
  if (payload.mediaKey !== undefined && !mediaKey) {
    return json({ error: "mediaKey is invalid." }, 400);
  }
  if (payload.mediaUrl && !mediaUrl) {
    return json({ error: "mediaUrl must be a valid http/https URL." }, 400);
  }
  if (payload.thumbnailUrl && !thumbnailUrl) {
    return json({ error: "thumbnailUrl must be a valid http/https URL." }, 400);
  }

  let committedMedia;
  try {
    committedMedia = await resolveCommittedMedia(env, {
      requestUrl: request.url,
      mediaUrl,
      mediaMime,
      mediaKey
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid media input." }, 400);
  }

  const finalMediaUrl = committedMedia.mediaUrl;
  const finalMediaMime = committedMedia.mediaMime;
  const finalThumbnail = thumbnailUrl ?? finalMediaUrl;

  if (!body && !finalMediaUrl) {
    return json({ error: "Body or media is required." }, 400);
  }

  const mediaKind = detectMediaKind(finalMediaUrl, finalMediaMime);
  if (mediaKind === "unknown") {
    return json({ error: "Only image/video media is allowed." }, 400);
  }

  const mediaType = mediaKind === "video" ? "video" : "image";

  const threadResult = await env.DB.prepare(
    `INSERT INTO threads (title, author_name, media_type, nsfw, is_locked)
     VALUES (?1, ?2, ?3, 0, 1)`
  )
    .bind(title, authorName, mediaType)
    .run();

  const threadId = Number(threadResult.meta.last_row_id);

  try {
    await env.DB.prepare(
      `INSERT INTO posts (
         thread_id, body, media_url, thumbnail_url, media_mime, author_name, nsfw
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)`
    )
      .bind(threadId, body ?? "", finalMediaUrl, finalThumbnail, finalMediaMime, authorName)
      .run();
  } catch {
    await env.DB.prepare("DELETE FROM threads WHERE id = ?1").bind(threadId).run();
    return json({ error: "Failed to create blog post." }, 500);
  }

  const created = await env.DB.prepare(
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
       AND t.is_deleted = 0`
  )
    .bind(threadId)
    .first();

  return json({ post: created }, 201);
};
