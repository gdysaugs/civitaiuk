import {
  cleanLongText,
  cleanText,
  cleanUrl,
  json,
  parseBool,
  parseOptionalFloat,
  parseOptionalInt,
  readJson
} from "../../_utils";
import { verifyTurnstile } from "../../_security";

type Env = {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
};

type CreatePostPayload = {
  threadId?: number;
  body?: string;
  authorName?: string;
  nsfw?: boolean;
  mediaUrl?: string;
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

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreatePostPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const threadId = parseOptionalInt(payload.threadId);
  const body = cleanLongText(payload.body, 5000);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const nsfw = parseBool(payload.nsfw);

  const mediaUrl = cleanUrl(payload.mediaUrl, 2000);
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
  if (!body) return json({ error: "Body is required." }, 400);
  if (payload.mediaUrl && !mediaUrl) return json({ error: "mediaUrl must be a valid http/https URL." }, 400);
  if (payload.thumbnailUrl && !thumbnailUrl) {
    return json({ error: "thumbnailUrl must be a valid http/https URL." }, 400);
  }

  const turnstile = await verifyTurnstile(request, env, payload.turnstileToken);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);

  const thread = await env.DB.prepare(
    `SELECT id, is_locked AS isLocked
     FROM threads
     WHERE id = ?1 AND is_deleted = 0`
  )
    .bind(threadId)
    .first<{ id: number; isLocked: number }>();
  if (!thread) return json({ error: "Thread not found." }, 404);
  if (thread.isLocked === 1) return json({ error: "Thread is locked." }, 403);

  const result = await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      media_mime, seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
  )
    .bind(
      threadId,
      body,
      prompt,
      workflowJson,
      mediaUrl,
      thumbnailUrl,
      mediaMime,
      seed,
      sampler,
      steps,
      cfgScale,
      width,
      height,
      authorName,
      nsfw
    )
    .run();

  const postId = Number(result.meta.last_row_id);
  const created = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl, media_mime AS mediaMime,
            seed, sampler,
            steps, cfg_scale AS cfgScale, width, height, author_name AS authorName,
            nsfw, created_at AS createdAt
     FROM posts
     WHERE id = ?1`
  )
    .bind(postId)
    .first();

  return json({ post: created }, 201);
};
