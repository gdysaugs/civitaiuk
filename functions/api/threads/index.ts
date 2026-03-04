import {
  buildPosterId,
  cleanLongText,
  cleanText,
  cleanUrl,
  createDeleteToken,
  detectMediaKind,
  json,
  parseBool,
  parseLimit,
  parseOptionalFloat,
  parseOptionalInt,
  readJson,
  sha256Hex,
  validateMediaType
} from "../../_utils";
import { isTurnstileRequired, verifyTurnstileWhen } from "../../_security";
import { cleanMediaKey, resolveCommittedMedia } from "../../_media";

type Env = {
  DB: D1Database;
  MEDIA?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
};

type CreateThreadPayload = {
  title?: string;
  body?: string;
  authorName?: string;
  modelName?: string;
  mediaType?: "image" | "video" | "mixed";
  nsfw?: boolean;
  mediaUrl?: string;
  mediaKey?: string;
  thumbnailUrl?: string;
  prompt?: string;
  workflowJson?: string;
  seed?: number;
  sampler?: string;
  steps?: number;
  cfgScale?: number;
  width?: number;
  height?: number;
  mediaMime?: string;
  turnstileToken?: string;
};

const DEFAULT_THREAD_THUMB_PATH = "/default-thread-thumb.webp";
const RAPID_POST_THRESHOLD = 5;
const THREAD_CREATE_COOLDOWN_MINUTES = 3;

function resolveThreadThumbnailUrl(
  requestUrl: string,
  mediaKind: "none" | "image" | "video" | "unknown",
  mediaUrl: string | null,
  requestedThumbnailUrl: string | null
): string {
  if (requestedThumbnailUrl) return requestedThumbnailUrl;
  if (mediaUrl && mediaKind === "image") return mediaUrl;
  return new URL(DEFAULT_THREAD_THUMB_PATH, requestUrl).toString();
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"), 50, 1, 100);
  const pageCandidate = parseOptionalInt(url.searchParams.get("page"));
  const page = pageCandidate && pageCandidate > 0 ? pageCandidate : 1;
  const offset = (page - 1) * limit;
  const includeNsfw = url.searchParams.get("nsfw") === "include" ? 1 : 0;

  const query = `
    SELECT
      t.id,
      t.title,
      t.author_name AS authorName,
      t.model_name AS modelName,
      t.media_type AS mediaType,
      t.nsfw,
      t.is_locked AS isLocked,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt,
      (
        SELECT COALESCE(p2.thumbnail_url, p2.media_url)
        FROM posts p2
        WHERE p2.thread_id = t.id
          AND p2.is_deleted = 0
          AND (p2.media_url IS NOT NULL OR p2.thumbnail_url IS NOT NULL)
        ORDER BY datetime(p2.created_at) ASC, p2.id ASC
        LIMIT 1
      ) AS thumbnailUrl,
      (
        SELECT p2.media_mime
        FROM posts p2
        WHERE p2.thread_id = t.id
          AND p2.is_deleted = 0
          AND (p2.media_url IS NOT NULL OR p2.thumbnail_url IS NOT NULL)
        ORDER BY datetime(p2.created_at) ASC, p2.id ASC
        LIMIT 1
      ) AS thumbnailMime,
      COUNT(CASE WHEN p.is_deleted = 0 THEN p.id END) AS postCount
    FROM threads t
    LEFT JOIN posts p ON p.thread_id = t.id
    WHERE t.is_deleted = 0
      AND (?1 = 1 OR t.nsfw = 0)
    GROUP BY t.id
    ORDER BY datetime(t.updated_at) DESC
    LIMIT ?2
    OFFSET ?3
  `;

  const { results } = await env.DB.prepare(query).bind(includeNsfw, limit, offset).all();
  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM threads
     WHERE is_deleted = 0
       AND (?1 = 1 OR nsfw = 0)`
  )
    .bind(includeNsfw)
    .first<{ total: number }>();

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return json({
    threads: results,
    limit,
    page,
    total,
    totalPages,
    includeNsfw: includeNsfw === 1
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreateThreadPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const title = cleanText(payload.title, 50);
  const body = cleanLongText(payload.body, 500);
  const authorName = cleanText(payload.authorName, 40) ?? "名無しちゃん";
  const modelName = cleanText(payload.modelName, 80);
  const mediaType = validateMediaType(payload.mediaType);
  const nsfw = parseBool(payload.nsfw);

  const mediaUrl = cleanUrl(payload.mediaUrl, 2000);
  const mediaKey = cleanMediaKey(payload.mediaKey);
  const thumbnailUrl = cleanUrl(payload.thumbnailUrl, 2000);
  const prompt = cleanLongText(payload.prompt, 4000);
  const workflowJson = cleanLongText(payload.workflowJson, 20000);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);
  const mediaMime = cleanText(payload.mediaMime, 120);

  if (!title || title.length < 3) return json({ error: "Title must be at least 3 chars." }, 400);
  if (!body && !mediaUrl && !mediaKey) return json({ error: "Body or media is required." }, 400);
  if (payload.mediaKey !== undefined && !mediaKey) {
    return json({ error: "mediaKey is invalid." }, 400);
  }
  if (payload.mediaUrl && !mediaUrl) return json({ error: "mediaUrl must be a valid http/https URL." }, 400);
  if (payload.thumbnailUrl && !thumbnailUrl) {
    return json({ error: "thumbnailUrl must be a valid http/https URL." }, 400);
  }

  const posterId = await buildPosterId(request);
  const sanction = await env.DB.prepare(
    `SELECT
       write_block_until AS writeBlockUntil,
       require_turnstile AS requireTurnstile,
       CASE
         WHEN write_block_until IS NOT NULL
           AND datetime(write_block_until) > datetime('now')
         THEN 1
         ELSE 0
       END AS isBlocked
     FROM poster_sanctions
     WHERE poster_id = ?1
     LIMIT 1`
  )
    .bind(posterId)
    .first<{ writeBlockUntil: string | null; requireTurnstile: number; isBlocked: number }>();
  if (Number(sanction?.isBlocked || 0) === 1) {
    return json(
      { error: `このIDは投稿停止中です。解除予定: ${sanction?.writeBlockUntil ?? "-"}` },
      403
    );
  }
  const sanctionRequiresTurnstile =
    Number(sanction?.requireTurnstile || 0) === 1 && Boolean(env.TURNSTILE_SECRET?.trim());

  const recentThreadByPoster = await env.DB.prepare(
    `SELECT p.id
     FROM posts p
     WHERE p.poster_id = ?1
       AND datetime(p.created_at) >= datetime('now', ?2)
       AND NOT EXISTS (
         SELECT 1
         FROM posts p2
         WHERE p2.thread_id = p.thread_id
           AND p2.id < p.id
       )
     LIMIT 1`
  )
    .bind(posterId, `-${THREAD_CREATE_COOLDOWN_MINUTES} minutes`)
    .first<{ id: number }>();
  if (recentThreadByPoster) {
    return json(
      { error: `スレッド作成は${THREAD_CREATE_COOLDOWN_MINUTES}分に1回までです。しばらく待ってください。` },
      429
    );
  }

  const recentByPoster = await env.DB.prepare(
    `SELECT COUNT(*) AS recentCount
     FROM posts
     WHERE poster_id = ?1
       AND datetime(created_at) >= datetime('now', '-1 minute')`
  )
    .bind(posterId)
    .first<{ recentCount: number }>();
  const recentPostCount = Number(recentByPoster?.recentCount || 0);
  const forceTurnstileByRate = recentPostCount + 1 >= RAPID_POST_THRESHOLD;
  const turnstileRequired = isTurnstileRequired(env) || forceTurnstileByRate || sanctionRequiresTurnstile;

  const turnstile = await verifyTurnstileWhen(request, env, payload.turnstileToken, turnstileRequired);
  if (!turnstile.ok) {
    if (forceTurnstileByRate && !payload.turnstileToken?.trim()) {
      return json({ error: "短時間に投稿が集中しています。人間認証後に再投稿してください。" }, 429);
    }
    if (sanctionRequiresTurnstile && !payload.turnstileToken?.trim()) {
      return json({ error: "このIDは人間認証後のみ投稿できます。" }, 403);
    }
    return json({ error: turnstile.error ?? "Human verification failed." }, 403);
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
  const mediaKind = detectMediaKind(finalMediaUrl, finalMediaMime);
  const resolvedThumbnailUrl = resolveThreadThumbnailUrl(
    request.url,
    mediaKind,
    finalMediaUrl,
    thumbnailUrl
  );

  if (!body && !finalMediaUrl) return json({ error: "Body or media is required." }, 400);
  if (mediaKind === "unknown") return json({ error: "Only image/video media is allowed." }, 400);
  const deleteToken = createDeleteToken();
  const deleteTokenHash = await sha256Hex(deleteToken);

  const threadResult = await env.DB.prepare(
    `INSERT INTO threads (title, author_name, model_name, media_type, nsfw)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(title, authorName, modelName, mediaType, nsfw)
    .run();

  const threadId = Number(threadResult.meta.last_row_id);
  let firstPostId: number | null = null;

  try {
    const postResult = await env.DB.prepare(
      `INSERT INTO posts (
        thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
        media_mime, seed, sampler, steps, cfg_scale, width, height, author_name, nsfw, poster_id, delete_token_hash
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
    )
      .bind(
        threadId,
        body ?? "",
        prompt,
        workflowJson,
        finalMediaUrl,
        resolvedThumbnailUrl,
        finalMediaMime,
        seed,
        sampler,
        steps,
        cfgScale,
        width,
        height,
        authorName,
        nsfw,
        posterId,
        deleteTokenHash
      )
      .run();

    const insertedPostId = Number(postResult.meta.last_row_id || 0);
    firstPostId = Number.isInteger(insertedPostId) && insertedPostId > 0 ? insertedPostId : null;
  } catch {
    try {
      await env.DB.prepare(
        `DELETE FROM threads
         WHERE id = ?1`
      )
        .bind(threadId)
        .run();
    } catch {
      // Best effort cleanup when first post insert fails.
    }
    return json({ error: "Failed to create thread. Please retry." }, 500);
  }

  const created = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, is_locked AS isLocked,
            created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1`
  )
    .bind(threadId)
    .first();

  return json({ thread: created, firstPostId, deleteToken }, 201);
};
