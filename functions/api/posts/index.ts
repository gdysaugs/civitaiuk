import {
  buildPosterId,
  cleanLongText,
  cleanText,
  cleanUrl,
  createDeleteToken,
  detectMediaKind,
  json,
  parseBool,
  parseOptionalFloat,
  parseOptionalInt,
  readJson,
  sha256Hex
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

type CreatePostPayload = {
  threadId?: number;
  body?: string;
  authorName?: string;
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

const MAX_POSTS_PER_THREAD = 1000;
const RAPID_POST_THRESHOLD = 5;

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreatePostPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const threadId = parseOptionalInt(payload.threadId);
  const body = cleanLongText(payload.body, 500);
  const authorName = cleanText(payload.authorName, 40) ?? "名無しちゃん";
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

  if (!threadId || threadId <= 0) return json({ error: "Valid threadId is required." }, 400);
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

  const deleteToken = createDeleteToken();
  const deleteTokenHash = await sha256Hex(deleteToken);

  const thread = await env.DB.prepare(
    `SELECT id, is_locked AS isLocked
     FROM threads
     WHERE id = ?1 AND is_deleted = 0`
  )
    .bind(threadId)
    .first<{ id: number; isLocked: number }>();
  if (!thread) return json({ error: "Thread not found." }, 404);
  if (thread.isLocked === 1) return json({ error: "Thread is locked." }, 403);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS postCount
     FROM posts
     WHERE thread_id = ?1
       AND is_deleted = 0`
  )
    .bind(threadId)
    .first<{ postCount: number }>();
  const currentPostCount = Number(countRow?.postCount || 0);
  if (currentPostCount >= MAX_POSTS_PER_THREAD) {
    await env.DB.prepare(
      `UPDATE threads
       SET is_locked = 1
       WHERE id = ?1`
    )
      .bind(threadId)
      .run();
    return json({ error: `Thread reached ${MAX_POSTS_PER_THREAD} posts and is now locked.` }, 403);
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

  if (!body && !finalMediaUrl) return json({ error: "Body or media is required." }, 400);
  if (mediaKind === "unknown") return json({ error: "Only image/video media is allowed." }, 400);

  const result = await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      media_mime, seed, sampler, steps, cfg_scale, width, height, author_name, nsfw, poster_id, delete_token_hash
    )
    SELECT
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
    WHERE EXISTS (
      SELECT 1
      FROM threads t
      WHERE t.id = ?18
        AND t.is_deleted = 0
        AND t.is_locked = 0
    )
      AND (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.thread_id = ?19
          AND p.is_deleted = 0
      ) < ?20`
  )
    .bind(
      threadId,
      body ?? "",
      prompt,
      workflowJson,
      finalMediaUrl,
      thumbnailUrl,
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
      deleteTokenHash,
      threadId,
      threadId,
      MAX_POSTS_PER_THREAD
    )
    .run();

  if (Number(result.meta.changes || 0) < 1) {
    const latestThread = await env.DB.prepare(
      `SELECT id, is_locked AS isLocked
       FROM threads
       WHERE id = ?1
         AND is_deleted = 0`
    )
      .bind(threadId)
      .first<{ id: number; isLocked: number }>();
    if (!latestThread) return json({ error: "Thread not found." }, 404);

    const latestCountRow = await env.DB.prepare(
      `SELECT COUNT(*) AS postCount
       FROM posts
       WHERE thread_id = ?1
         AND is_deleted = 0`
    )
      .bind(threadId)
      .first<{ postCount: number }>();
    const latestPostCount = Number(latestCountRow?.postCount || 0);

    if (latestPostCount >= MAX_POSTS_PER_THREAD) {
      await env.DB.prepare(
        `UPDATE threads
         SET is_locked = 1
         WHERE id = ?1`
      )
        .bind(threadId)
        .run();
      return json({ error: `Thread reached ${MAX_POSTS_PER_THREAD} posts and is now locked.` }, 403);
    }

    if (latestThread.isLocked === 1) {
      return json({ error: "Thread is locked." }, 403);
    }

    return json({ error: "Posting state changed. Please retry." }, 409);
  }

  await env.DB.prepare(
    `UPDATE threads
     SET is_locked = 1
     WHERE id = ?1
       AND (
         SELECT COUNT(*)
         FROM posts
         WHERE thread_id = ?1
           AND is_deleted = 0
       ) >= ?2`
  )
    .bind(threadId, MAX_POSTS_PER_THREAD)
    .run();

  const postId = Number(result.meta.last_row_id);
  const created = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl, media_mime AS mediaMime,
            seed, sampler,
            steps, cfg_scale AS cfgScale, width, height, author_name AS authorName,
            nsfw, poster_id AS posterId, created_at AS createdAt
     FROM posts
     WHERE id = ?1`
  )
    .bind(postId)
    .first();

  return json({ post: created, deleteToken }, 201);
};
